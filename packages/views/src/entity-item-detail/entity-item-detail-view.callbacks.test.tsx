/**
 * The view's wiring of the item feature's callbacks. `EntityItemContentFocusBody` is stubbed to
 * buttons that fire the same callbacks the real feature does, so these tests isolate what the
 * view does with them: relation clicks and "create" go to the navigation object, relation
 * problems open the dialog.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemDetailView } from "./entity-item-detail-view";

vi.mock("@contentgrid/features/entity-item", () => ({
  entityItemContentFocusPadding: () => true,
  // The breadcrumbs draw the loaded item with it.
  EntityItemReference: () => <span>item-reference</span>,
  EntityItemContentFocusBody: (props: {
    onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
    onRelationItemCreateNew?: (entityName: string) => void;
    onMissingRelationTargetClick?: (url: string, field?: string) => void;
    onBlindRelationOverwriteClick?: (info: { existingItem?: string; newItem?: string }) => void;
    onRequiredRelationClick?: (affectedRelation: string) => void;
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
