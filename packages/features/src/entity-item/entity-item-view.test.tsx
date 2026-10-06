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

describe("EntityItemView", () => {
  it("keeps an open edit form and its input under an alert when a background refetch fails", async () => {
    const user = userEvent.setup();
    const { id, profileEntity } = makeAllAttributeItem();
    let itemRequests = 0;
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: {} })),
      http.get(ALL_ATTRIBUTE_ITEM_URL, () => {
        itemRequests++;
        return itemRequests === 1
          ? HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v1"' } })
          : new HttpResponse(null, { status: 500 });
      }),
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
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Text"), " changed");

    await queryClient.invalidateQueries();
    await waitFor(() => expect(itemRequests).toBe(2));

    expect(await screen.findByText("This item could not be refreshed")).toBeVisible();
    expect(screen.getByLabelText("Text")).toHaveValue("Test string changed");

    // Retry reloads the item; once that succeeds the alert goes and the form keeps the input.
    itemRequests = 0;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.queryByText("This item could not be refreshed")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Text")).toHaveValue("Test string changed");
  });
});
