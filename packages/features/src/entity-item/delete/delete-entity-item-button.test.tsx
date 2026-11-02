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
import { server } from "../../../test-setup";
import { DeleteEntityItemButton } from "./delete-entity-item-button";

const noopSupplier: AuthenticationTokenSupplier = async () => null;
const PROFILE_URL = "https://api.example.contentgrid.com/profile";

function renderButton(item: EntityItem) {
  const onDeleted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl={PROFILE_URL}
      >
        <DeleteEntityItemButton item={item} onDeleted={onDeleted} />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );
  return { onDeleted };
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
});
