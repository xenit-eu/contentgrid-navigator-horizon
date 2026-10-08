import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  ALL_ATTRIBUTE_ITEM_URL,
  allAttributeItemBodyWith,
  makeAllAttributeItem,
} from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { server } from "../../test-setup";
import { EntityItemView } from "./entity-item-view";

const noopSupplier: AuthenticationTokenSupplier = async () => null;
const PROFILE_URL = "https://api.example.contentgrid.com/profile";

/** Renders the item page for the `all-attribute` fixture item; `item` answers each item GET. */
function renderItemPage(item: (request: number) => Response) {
  const { id, profileEntity } = makeAllAttributeItem();
  let itemRequests = 0;
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json({ _links: {} })),
    http.get(ALL_ATTRIBUTE_ITEM_URL, () => item(++itemRequests)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <EntityItemView profile={profileEntity} itemId={id} />,
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl={PROFILE_URL}
      >
        <RouterProvider router={router} />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );
  return { queryClient, itemRequests: () => itemRequests };
}

describe("EntityItemView", () => {
  it("keeps an open edit form and its input when a background refetch fails", async () => {
    const user = userEvent.setup();
    const page = renderItemPage((request) =>
      request === 1
        ? HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v1"' } })
        : new HttpResponse(null, { status: 500 }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Text"), " changed");

    await page.queryClient.invalidateQueries();
    await waitFor(() => expect(page.itemRequests()).toBe(2));

    expect(screen.getByLabelText("Text")).toHaveValue("Test string changed");
  });

  it("keeps the input when a background refetch brings a newer version, and refuses the save", async () => {
    const user = userEvent.setup();
    const ifMatch: (string | null)[] = [];
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, ({ request }) => {
        ifMatch.push(request.headers.get("If-Match"));
        return HttpResponse.json(
          { status: 412, type: "https://contentgrid.cloud/problems/unsatisfied-version" },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );
    const page = renderItemPage((request) =>
      request === 1
        ? HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v1"' } })
        : HttpResponse.json(allAttributeItemBodyWith({ text: "Theirs" }), {
            headers: { ETag: '"v2"' },
          }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Text"), " mine");

    await page.queryClient.invalidateQueries();
    await waitFor(() => expect(page.itemRequests()).toBe(2));

    expect(screen.getByLabelText("Text")).toHaveValue("Test string mine");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("This item has been updated by someone else"),
    ).toBeInTheDocument();
    expect(ifMatch).toEqual(['"v1"']);
  });

  it("leaves edit mode and shows the saved values after a successful save", async () => {
    const user = userEvent.setup();
    server.use(http.put(ALL_ATTRIBUTE_ITEM_URL, () => new HttpResponse(null, { status: 204 })));
    renderItemPage((request) =>
      request === 1
        ? HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v1"' } })
        : HttpResponse.json(allAttributeItemBodyWith({ text: "Saved" }), {
            headers: { ETag: '"v2"' },
          }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByLabelText("Text")).not.toBeInTheDocument());
    expect(screen.getAllByText("Saved")).not.toHaveLength(0);
  });

  it("on a conflict, Refresh reopens the form on the latest version", async () => {
    const user = userEvent.setup();
    const ifMatch: (string | null)[] = [];
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, ({ request }) => {
        ifMatch.push(request.headers.get("If-Match"));
        if (ifMatch.length > 1) return new HttpResponse(null, { status: 204 });
        return HttpResponse.json(
          { status: 412, type: "https://contentgrid.cloud/problems/unsatisfied-version" },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );
    renderItemPage((request) =>
      request === 1
        ? HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v1"' } })
        : HttpResponse.json(allAttributeItemBodyWith({ text: "Theirs" }), {
            headers: { ETag: '"v2"' },
          }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Text"), " mine");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await user.click(await screen.findByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("Theirs"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(ifMatch).toEqual(['"v1"', '"v2"']));
  });
});
