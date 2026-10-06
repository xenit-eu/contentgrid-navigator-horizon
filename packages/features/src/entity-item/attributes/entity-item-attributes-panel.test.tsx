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
import { EntityItemAttributesPanel } from "./entity-item-attributes-panel";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

/** Renders the panel inside a router, which the edit view's unsaved-changes guard needs. */
async function renderPanel(item: EntityItem) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <EntityItemAttributesPanel item={item} /> }),
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
  await screen.findByRole("heading", { name: "Attributes" });
}

describe("EntityItemAttributesPanel", () => {
  it("offers no Edit action when the item has no update form", async () => {
    await renderPanel(makeAllAttributeItem({ _templates: {} }));

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("offers no Edit action when the update form has no properties", async () => {
    const { defaultTemplate } = makeAllAttributeItem();
    await renderPanel(
      makeAllAttributeItem({ _templates: { default: { ...defaultTemplate, properties: [] } } }),
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("leaves edit mode on Cancel without asking when nothing changed", async () => {
    const user = userEvent.setup();
    await renderPanel(makeAllAttributeItem());

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Text")).toHaveValue("Test string");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Text")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  it("asks before discarding changes on Cancel", async () => {
    const user = userEvent.setup();
    await renderPanel(makeAllAttributeItem());
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
