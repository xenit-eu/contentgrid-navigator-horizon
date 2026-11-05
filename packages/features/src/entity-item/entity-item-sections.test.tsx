import { type Ref, useImperativeHandle } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import {
  EntityItemSections,
  type EntityItemSectionsProps,
  hasEntityItemRelations,
} from "./entity-item-sections";
import { useEntityItemContext } from "./use-entity-item-context";

const cancelEditForm = vi.fn();

function MockEditableEntityItemAttributes({
  item,
  isEditing,
  editFormRef,
}: {
  item: EntityItem;
  isEditing: boolean;
  editFormRef?: Ref<{ cancel: () => void }>;
}) {
  useImperativeHandle(editFormRef, () => ({ cancel: cancelEditForm }));
  return <div>{isEditing ? `editing ${item.id}` : `attributes ${item.id}`}</div>;
}

vi.mock("./attributes/editable-entity-item-attributes", () => ({
  EditableEntityItemAttributes: MockEditableEntityItemAttributes,
}));

vi.mock("./attributes/entity-item-attributes", () => ({
  hasAuditTrail: (item: { audit?: boolean }) => item.audit === true,
  EntityItemAuditTrail: () => <div>audit trail</div>,
}));

vi.mock("./edit/edit-entity-item-button", () => ({
  EditEntityItemButton: ({ isEditing, onEdit }: { isEditing: boolean; onEdit: () => void }) =>
    isEditing ? null : (
      <button type="button" onClick={onEdit}>
        Edit
      </button>
    ),
  CancelEditEntityItemButton: ({ onCancel }: { onCancel: () => void }) => (
    <button type="button" onClick={onCancel}>
      Cancel edit
    </button>
  ),
}));

vi.mock("./relations/relation-to-one-section", () => ({
  RelationToOneSection: ({
    relation,
    open,
    variant,
  }: {
    relation: { name: string };
    open: boolean;
    variant: string;
  }) => <div data-variant={variant}>{`to-one ${relation.name} ${open ? "open" : "closed"}`}</div>,
}));

vi.mock("./relations/relation-to-many-section", () => ({
  RelationToManySection: ({
    relation,
    open,
    variant,
  }: {
    relation: { name: string };
    open: boolean;
    variant: string;
  }) => <div data-variant={variant}>{`to-many ${relation.name} ${open ? "open" : "closed"}`}</div>,
}));

function makeItem(
  overrides: Partial<{ id: string; toOne: string[]; toMany: string[]; audit: boolean }> = {},
): EntityItem {
  return {
    id: overrides.id ?? "item-1",
    selfLink: { href: `https://api.example.com/items/${overrides.id ?? "item-1"}` },
    audit: overrides.audit ?? false,
    toOneRelations: (overrides.toOne ?? []).map((name) => ({ name })),
    toManyRelations: (overrides.toMany ?? []).map((name) => ({ name })),
  } as unknown as EntityItem;
}

function Harness(props: Partial<Omit<EntityItemSectionsProps, "state">> & { item: EntityItem }) {
  const state = useEntityItemContext(props.item).sections;
  return (
    <EntityItemSections
      profiles={[]}
      state={state}
      editedItem={null}
      onEditingChange={vi.fn()}
      onRefresh={vi.fn()}
      {...props}
    />
  );
}

describe("EntityItemSections", () => {
  it("stacks attributes, relations and audit, with to-one open and to-many collapsed", () => {
    render(<Harness item={makeItem({ toOne: ["customer"], toMany: ["invoices"], audit: true })} />);

    expect(screen.getByText("attributes item-1")).toBeInTheDocument();
    expect(screen.getByText("to-one customer open")).toBeInTheDocument();
    expect(screen.getByText("to-many invoices closed")).toBeInTheDocument();
    expect(screen.getByText("audit trail")).toBeInTheDocument();
  });

  it("leaves out the audit section when the item has no audit trail", () => {
    render(<Harness item={makeItem()} />);

    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
  });

  it("collapses a section when its row is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness item={makeItem()} />);

    await user.click(screen.getByRole("button", { name: "Attributes" }));
    expect(screen.queryByText("attributes item-1")).not.toBeInTheDocument();
  });

  it("Edit expands the attributes section and starts editing", async () => {
    const user = userEvent.setup();
    const onEditingChange = vi.fn();
    render(<Harness item={makeItem()} onEditingChange={onEditingChange} />);

    await user.click(screen.getByRole("button", { name: "Attributes" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEditingChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("attributes item-1")).toBeInTheDocument();
  });

  it("keeps the attributes section open while editing", async () => {
    const user = userEvent.setup();
    render(<Harness item={makeItem()} editedItem={makeItem({ id: "item-1-v1" })} />);

    await user.click(screen.getByRole("button", { name: "Attributes" }));

    expect(screen.getByText("editing item-1-v1")).toBeInTheDocument();
  });

  it("keeps a relation's open state apart from a built-in section of the same name", async () => {
    const user = userEvent.setup();
    render(<Harness item={makeItem({ toOne: ["attributes"] })} />);

    await user.click(screen.getByRole("button", { name: "Attributes" }));

    expect(screen.queryByText("attributes item-1")).not.toBeInTheDocument();
    expect(screen.getByText("to-one attributes open")).toBeInTheDocument();
  });

  it("shows the edited version while editing", () => {
    render(<Harness item={makeItem()} editedItem={makeItem({ id: "item-1-v1" })} />);

    expect(screen.getByText("editing item-1-v1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("puts a cancel button in the Edit button's place, which cancels the update form", async () => {
    const user = userEvent.setup();
    cancelEditForm.mockClear();
    render(<Harness item={makeItem()} editedItem={makeItem({ id: "item-1-v1" })} />);

    await user.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(cancelEditForm).toHaveBeenCalledOnce();
  });

  it("show=details renders only the attributes and audit trail", () => {
    render(<Harness item={makeItem({ toOne: ["customer"], audit: true })} show="details" />);

    expect(screen.getByText("attributes item-1")).toBeInTheDocument();
    expect(screen.getByText("audit trail")).toBeInTheDocument();
    expect(screen.queryByText("to-one customer open")).not.toBeInTheDocument();
  });

  it("renders relations as rows by default, or as cards of their own", () => {
    const { rerender } = render(<Harness item={makeItem({ toOne: ["customer"] })} />);
    expect(screen.getByText("to-one customer open")).toHaveAttribute("data-variant", "row");

    rerender(
      <Harness item={makeItem({ toOne: ["customer"] })} show="relations" relationVariant="card" />,
    );
    expect(screen.getByText("to-one customer open")).toHaveAttribute("data-variant", "card");
  });

  it("show=relations renders only the relations", () => {
    render(
      <Harness
        item={makeItem({ toOne: ["customer"], toMany: ["invoices"], audit: true })}
        show="relations"
      />,
    );

    expect(screen.getByText("to-one customer open")).toBeInTheDocument();
    expect(screen.getByText("to-many invoices closed")).toBeInTheDocument();
    expect(screen.queryByText("attributes item-1")).not.toBeInTheDocument();
    expect(screen.queryByText("audit trail")).not.toBeInTheDocument();
  });
});

describe("hasEntityItemRelations", () => {
  it("is true when the item has a to-one or to-many relation", () => {
    expect(hasEntityItemRelations(makeItem())).toBe(false);
    expect(hasEntityItemRelations(makeItem({ toOne: ["customer"] }))).toBe(true);
    expect(hasEntityItemRelations(makeItem({ toMany: ["invoices"] }))).toBe(true);
  });
});
