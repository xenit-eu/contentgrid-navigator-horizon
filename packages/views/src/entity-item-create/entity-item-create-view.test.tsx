import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemCreateView } from "./entity-item-create-view";

// The form needs a router for its unsaved-changes guard; stand-ins expose the callbacks the view wires.
vi.mock("@contentgrid/features/entity-item-create", () => ({
  CreateEntityItemPanel: (props: {
    profile: ProfileEntity;
    onCreated: (item: EntityItem) => void;
    onCancel: () => void;
    onRelationItemClick: (entityName: string, id: string) => void;
    onRelationItemCreateNew: (entityName: string) => void;
  }) => (
    <div data-testid="create-form" data-entity={props.profile.name}>
      <button onClick={() => props.onCreated({ id: "cust-042" } as EntityItem)}>Created</button>
      <button onClick={props.onCancel}>Cancel</button>
      <button onClick={() => props.onRelationItemClick("invoice", "inv-1")}>Relation item</button>
      <button onClick={() => props.onRelationItemCreateNew("invoice")}>Relation create</button>
    </div>
  ),
  CreateEntityItemProfileSelector: (props: {
    selectedProfile: ProfileEntity;
    onSelect: (profile: ProfileEntity) => void;
  }) => (
    <button onClick={() => props.onSelect({ name: "invoice" } as ProfileEntity)}>
      Selected: {props.selectedProfile.name}
    </button>
  ),
}));

function renderView(props: Partial<Parameters<typeof EntityItemCreateView>[0]> = {}) {
  const harness = createItemDetailTestHarness();
  render(<EntityItemCreateView entityName="customer" {...props} />, { wrapper: harness.Wrapper });
  return harness;
}

describe("EntityItemCreateView", () => {
  it("shows the entity's create form under a Home › collection › Create trail", async () => {
    renderView();

    expect(await screen.findByTestId("create-form")).toHaveAttribute("data-entity", "customer");
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("Create customer");
  });

  it("opens the new item once created, and the collection on Cancel", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("button", { name: "Created" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(recording.calls).toEqual([
      { method: "openItem", args: ["customer", "cust-042"] },
      { method: "openEntityItemCollection", args: ["customer"] },
    ]);
  });

  it("opens a relation's item and its create form in a new tab", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("button", { name: "Relation item" }));
    await userEvent.click(screen.getByRole("button", { name: "Relation create" }));

    expect(recording.calls).toEqual([
      { method: "openItem", args: ["invoice", "inv-1", { openInNewTab: true }] },
      { method: "openCreateItem", args: ["invoice", { openInNewTab: true }] },
    ]);
  });

  it("opens another entity's create form from the entity selector in the toolbar", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("button", { name: "Selected: customer" }));

    expect(recording.calls).toEqual([{ method: "openCreateItem", args: ["invoice"] }]);
  });

  it("goes home and to the collection through the breadcrumbs", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("link", { name: "Customers" }));
    await userEvent.click(screen.getByRole("link", { name: "Home" }));

    expect(recording.calls).toEqual([
      { method: "openEntityItemCollection", args: ["customer"] },
      { method: "openHome", args: [] },
    ]);
  });

  it("draws no toolbar when hidden", async () => {
    renderView({ toolbar: false });

    expect(await screen.findByTestId("create-form")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selected:/ })).not.toBeInTheDocument();
  });

  it("adds the host's toolbar actions after the entity selector", async () => {
    renderView({ toolbar: { actions: <button>Host action</button> } });

    expect(await screen.findByRole("button", { name: "Selected: customer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Host action" })).toBeInTheDocument();
  });

  it("shows not-found for an unknown entity", async () => {
    renderView({ entityName: "nope" });

    expect(await screen.findByText(/No profile for entity "nope"/)).toBeInTheDocument();
    expect(screen.queryByTestId("create-form")).not.toBeInTheDocument();
  });
});
