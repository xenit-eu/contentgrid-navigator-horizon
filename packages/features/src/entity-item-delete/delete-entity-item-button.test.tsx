import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  ALL_ATTRIBUTE_ITEM_URL,
  makeAllAttributeItem,
} from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { Toaster } from "@contentgrid/ui";
import { server } from "../../test-setup";
import { DeleteEntityItemButton } from "./delete-entity-item-button";

const noopSupplier: AuthenticationTokenSupplier = async () => null;
const PROFILE_URL = "https://api.example.contentgrid.com/profile";

function renderButton(item: EntityItem, label?: string) {
  const onDeleted = vi.fn();
  const onRefresh = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (shownItem: EntityItem) => (
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl={PROFILE_URL}
      >
        <DeleteEntityItemButton
          item={shownItem}
          onDeleted={onDeleted}
          onRefresh={onRefresh}
          label={label}
        />
        <Toaster />
      </NavigatorDataProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(item));
  // Stands in for the caller passing the reloaded item back down.
  const showItem = (reloaded: EntityItem) => rerender(tree(reloaded));
  return { onDeleted, onRefresh, showItem };
}

/** Opens the confirmation dialog and confirms; returns the dialog. */
async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));
  return dialog;
}

describe("DeleteEntityItemButton", () => {
  it("is hidden when the item has no delete template", () => {
    renderButton(makeAllAttributeItem({ _templates: {} }));

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("sends a DELETE carrying the item's ETag, then calls onDeleted", async () => {
    const user = userEvent.setup();
    const ifMatch: (string | null)[] = [];
    server.use(
      http.delete(ALL_ATTRIBUTE_ITEM_URL, ({ request }) => {
        ifMatch.push(request.headers.get("If-Match"));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onDeleted } = renderButton(makeAllAttributeItem({}, '"v1"'));

    await confirmDelete(user);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(ifMatch).toEqual(['"v1"']);
  });

  it("shows its label as text when it has one", async () => {
    const user = userEvent.setup();
    server.use(http.delete(ALL_ATTRIBUTE_ITEM_URL, () => new HttpResponse(null, { status: 204 })));
    const { onDeleted } = renderButton(makeAllAttributeItem({}, '"v1"'), "Delete");

    expect(screen.getByRole("button", { name: "Delete" })).toHaveTextContent("Delete");
    await confirmDelete(user);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("shows the problem in the dialog when the delete fails, and doesn't call onDeleted", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(ALL_ATTRIBUTE_ITEM_URL, () =>
        HttpResponse.json(
          { title: "Forbidden", detail: "You may not delete this item.", status: 403 },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const { onDeleted } = renderButton(makeAllAttributeItem({}, '"v1"'));

    const dialog = await confirmDelete(user);

    expect(await within(dialog).findByText("You may not delete this item.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("on a version conflict, refreshes the item, closes the dialog and retries with the new ETag", async () => {
    const user = userEvent.setup();
    const ifMatch: (string | null)[] = [];
    server.use(
      http.delete(ALL_ATTRIBUTE_ITEM_URL, ({ request }) => {
        const etag = request.headers.get("If-Match");
        ifMatch.push(etag);
        return etag === '"v2"'
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json(
              { title: "Precondition Failed", status: 412 },
              { status: 412, headers: { "Content-Type": "application/problem+json" } },
            );
      }),
    );
    const { onDeleted, onRefresh, showItem } = renderButton(makeAllAttributeItem({}, '"v1"'));

    await confirmDelete(user);

    expect(await screen.findByText("This item was changed by someone else.")).toBeInTheDocument();
    expect(screen.getByText("Check the latest version and delete again.")).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onDeleted).not.toHaveBeenCalled();

    showItem(makeAllAttributeItem({}, '"v2"'));
    await confirmDelete(user);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(ifMatch).toEqual(['"v1"', '"v2"']);
  });
});
