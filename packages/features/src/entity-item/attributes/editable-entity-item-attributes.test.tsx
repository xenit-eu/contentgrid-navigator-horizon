import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeAllAttributeItem } from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { EditEntityItemButton } from "../edit/edit-entity-item-button";
import { EditableEntityItemAttributes } from "./editable-entity-item-attributes";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

/** Holds edit mode the way the item pages do: the Edit button opens it, the form closes it. */
function EditableAttributesHost({ item }: Readonly<{ item: EntityItem }>) {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <>
      <EditEntityItemButton item={item} isEditing={isEditing} onEdit={() => setIsEditing(true)} />
      <EditableEntityItemAttributes
        item={item}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        onRefresh={() => {}}
      />
    </>
  );
}

/** Renders inside a router, which the form's unsaved-changes guard needs. */
async function renderAttributes(item: EntityItem) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <EditableAttributesHost item={item} /> }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl="https://api.example.contentgrid.com/profile"
      >
        <RouterProvider router={router} />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Text");
}

describe("EditableEntityItemAttributes", () => {
  it("offers no Edit action when the item has no update form", async () => {
    await renderAttributes(makeAllAttributeItem({ _templates: {} }));

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("offers no Edit action when the update form has no properties", async () => {
    const { defaultTemplate } = makeAllAttributeItem();
    await renderAttributes(
      makeAllAttributeItem({ _templates: { default: { ...defaultTemplate, properties: [] } } }),
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("leaves edit mode on Cancel without asking when nothing changed", async () => {
    const user = userEvent.setup();
    await renderAttributes(makeAllAttributeItem());

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Text")).toHaveValue("Test string");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Text")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  it("asks before discarding changes on Cancel", async () => {
    const user = userEvent.setup();
    await renderAttributes(makeAllAttributeItem());
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Text"), " changed");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Stay" }));
    expect(screen.getByLabelText("Text")).toHaveValue("Test string changed");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(screen.queryByLabelText("Text")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
  });
});
