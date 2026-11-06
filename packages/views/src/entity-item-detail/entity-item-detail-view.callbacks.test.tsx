/**
 * The view's wiring of the item feature's callbacks. `EntityItemAutoVariation` is stubbed to
 * buttons that fire the same callbacks the real feature does, so these tests isolate what the
 * view does with them: relation clicks and "create" go to the navigation object, relation
 * problems open the dialog, and a finished delete opens the item's collection. The delete button
 * is stubbed too; for content focus the view draws it in the toolbar.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemDetailView } from "./entity-item-detail-view";

const resolveEntityItemVariation = vi.hoisted(() =>
  vi.fn((): "attribute-focus" | "content-focus" => "attribute-focus"),
);

beforeEach(() => {
  resolveEntityItemVariation.mockReturnValue("attribute-focus");
});

vi.mock("@contentgrid/features/entity-item-delete", () => ({
  DeleteEntityItemButton: (props: { label?: string; onDeleted: () => void }) => (
    <button onClick={props.onDeleted}>{`toolbar-${props.label}`}</button>
  ),
}));

vi.mock("@contentgrid/features/entity-item", () => ({
  entityItemDetailPadding: () => true,
  resolveEntityItemVariation,
  // The breadcrumbs draw the loaded item with it.
  EntityItemReference: () => <span>item-reference</span>,
  EntityItemAutoVariation: (props: {
    onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
    onRelationItemCreateNew?: (entityName: string) => void;
    onMissingRelationTargetClick?: (url: string, field?: string) => void;
    onBlindRelationOverwriteClick?: (info: { existingItem?: string; newItem?: string }) => void;
    onRequiredRelationClick?: (affectedRelation: string) => void;
    onDeleted?: () => void;
  }) => (
    <div>
      <button onClick={() => props.onRelationItemClick?.({ entityName: "company", itemId: "c-1" })}>
        relation-click
      </button>
      <button onClick={() => props.onRelationItemCreateNew?.("company")}>relation-create</button>
      <button onClick={() => props.onMissingRelationTargetClick?.("https://api.example.com/x")}>
        missing
      </button>
      <button
        onClick={() =>
          props.onBlindRelationOverwriteClick?.({ existingItem: "https://api.example.com/e" })
        }
      >
        blind
      </button>
      <button onClick={() => props.onRequiredRelationClick?.("owner")}>required</button>
      <button onClick={() => props.onDeleted?.()}>deleted</button>
    </div>
  ),
}));

const setup = createItemDetailTestHarness;

const entityName = "customer";
const itemId = "cust-001";

describe("EntityItemDetailView — feature callbacks", () => {
  it("opens a clicked relation item through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("relation-click"));

    expect(recording.calls).toEqual([{ method: "openItem", args: ["company", "c-1"] }]);
  });

  it("hands relation creation to the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("relation-create"));

    expect(recording.calls).toEqual([
      { method: "openCreateItem", args: ["company", { openInNewTab: true }] },
    ]);
  });

  it("opens the item's collection after the item is deleted", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("deleted"));

    expect(recording.calls).toEqual([{ method: "openEntityItemCollection", args: [entityName] }]);
  });

  it("leaves Delete to the variation for attribute focus", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await screen.findByText("deleted");
    expect(screen.queryByText("toolbar-Delete")).not.toBeInTheDocument();
  });

  it("draws Delete in the toolbar for content focus, opening the collection after a delete", async () => {
    resolveEntityItemVariation.mockReturnValue("content-focus");
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("toolbar-Delete"));

    expect(recording.calls).toEqual([{ method: "openEntityItemCollection", args: [entityName] }]);
  });

  it.each([
    ["missing", "Linked item not found"],
    ["blind", "Relation already linked"],
    ["required", "Required relation"],
  ])("opens the problem dialog for %s", async (button, title) => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText(button));
    expect(await screen.findByText(title)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it("hands the feature the loaded item, with no toolbar when hidden", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} toolbar={false} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText("relation-click")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
});
