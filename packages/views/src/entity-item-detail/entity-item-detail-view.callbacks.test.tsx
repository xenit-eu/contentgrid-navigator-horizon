/**
 * The view's wiring of the item feature's callbacks. `EntityItemAutoVariation` is stubbed to
 * buttons that fire the same callbacks the real feature does, so these tests isolate what the
 * view does with them: relation clicks and "create" go to the navigation object, relation
 * problems open the dialog, and a finished delete opens the item's collection. The delete button
 * is stubbed too; with a toolbar the view draws it there, without one the variation draws its own
 * (`onDeleted`).
 */
import { useImperativeHandle } from "react";
import type { Ref } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemDetailView } from "./entity-item-detail-view";

vi.mock("@contentgrid/features/entity-item-delete", () => ({
  DeleteEntityItemButton: (props: { label?: string; onDeleted: () => void }) => (
    <button onClick={props.onDeleted}>{`delete-${props.label ?? "icon-only"}`}</button>
  ),
}));

// Whether the stubbed item allows Edit (its update template, in the real feature).
let itemIsEditable = false;
// What the stubbed feature last did through the view's edit handle.
const editHandleCalls: string[] = [];

vi.mock("@contentgrid/features/entity-item", () => ({
  useEntityItemDetailPadding: () => true,
  isEditableEntityItem: () => itemIsEditable,
  // The breadcrumbs draw the loaded item with it.
  EntityItemReference: () => <span>item-reference</span>,
  EntityItemAutoVariation: (props: {
    onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
    onRelationItemCreateNew?: (entityName: string) => void;
    onMissingRelationTargetClick?: (url: string, field?: string) => void;
    onBlindRelationOverwriteClick?: (info: { existingItem?: string; newItem?: string }) => void;
    onRequiredRelationClick?: (affectedRelation: string) => void;
    onDeleted?: () => void;
    onEditingChange?: (isEditing: boolean) => void;
    editHandleRef?: Ref<{ startEdit: () => void; cancelEdit: () => void }>;
  }) => {
    // The same handle the real feature fills: starting and cancelling edit mode.
    useImperativeHandle(props.editHandleRef, () => ({
      startEdit: () => {
        editHandleCalls.push("startEdit");
        props.onEditingChange?.(true);
      },
      cancelEdit: () => {
        editHandleCalls.push("cancelEdit");
        props.onEditingChange?.(false);
      },
    }));
    return (
      <div>
        <button onClick={() => props.onEditingChange?.(true)}>start-editing</button>
        <button onClick={() => props.onEditingChange?.(false)}>stop-editing</button>
        <button
          onClick={() => props.onRelationItemClick?.({ entityName: "company", itemId: "c-1" })}
        >
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
    );
  },
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

  it("draws Delete in the toolbar, opening the collection after a delete", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("delete-Delete"));

    expect(recording.calls).toEqual([{ method: "openEntityItemCollection", args: [entityName] }]);
  });

  it("hides the toolbar's Delete while the item is being edited", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });
    await screen.findByText("delete-Delete");

    await userEvent.click(screen.getByText("start-editing"));
    expect(screen.queryByText("delete-Delete")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("stop-editing"));
    expect(screen.getByText("delete-Delete")).toBeInTheDocument();
  });

  it("does not hand the variation onDeleted when Delete is in the toolbar", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("deleted"));

    expect(recording.calls).toEqual([]);
  });

  it("leaves Delete to the variation when there is no toolbar, opening the collection after a delete", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} toolbar={false} />, {
      wrapper: Wrapper,
    });

    await userEvent.click(await screen.findByText("deleted"));

    expect(screen.queryByText("delete-Delete")).not.toBeInTheDocument();
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

  describe("Edit in the toolbar", () => {
    beforeEach(() => {
      itemIsEditable = true;
      editHandleCalls.length = 0;
    });
    afterEach(() => {
      itemIsEditable = false;
    });

    it("draws an Edit button that starts the feature's edit mode, then reads Cancel edit", async () => {
      const { Wrapper } = setup();
      render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, {
        wrapper: Wrapper,
      });

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      expect(editHandleCalls).toEqual(["startEdit"]);
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
      expect(editHandleCalls).toEqual(["startEdit", "cancelEdit"]);
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("draws Edit left of Delete", async () => {
      const { Wrapper } = setup();
      render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, {
        wrapper: Wrapper,
      });

      const edit = await screen.findByRole("button", { name: "Edit" });
      const del = screen.getByText("delete-Delete");
      expect(edit.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("draws no Edit button without a toolbar", async () => {
      const { Wrapper } = setup();
      render(<EntityItemDetailView entityName={entityName} itemId={itemId} toolbar={false} />, {
        wrapper: Wrapper,
      });

      await screen.findByText("start-editing");
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });
  });

  it("draws no Edit button when the item does not allow editing", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await screen.findByText("delete-Delete");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
