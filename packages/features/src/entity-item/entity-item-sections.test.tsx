import { type Ref, useImperativeHandle } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import {
  EntityItemSections,
  type EntityItemSectionsProps,
  useEntityItemSectionsState,
} from "./entity-item-sections";

vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    ResizableSplitLayout: ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
      <div data-testid="split">
        <div data-testid="split-left">{left}</div>
        <div data-testid="split-right">{right}</div>
      </div>
    ),
  };
});

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
  RelationToOneSection: ({ relation, open }: { relation: { name: string }; open: boolean }) => (
    <div>{`to-one ${relation.name} ${open ? "open" : "closed"}`}</div>
  ),
}));

vi.mock("./relations/relation-to-many-section", () => ({
  RelationToManySection: ({ relation, open }: { relation: { name: string }; open: boolean }) => (
    <div>{`to-many ${relation.name} ${open ? "open" : "closed"}`}</div>
  ),
}));

function makeItem(
  overrides: Partial<{ id: string; toOne: string[]; toMany: string[]; audit: boolean }> = {},
): EntityItem {
  return {
    id: overrides.id ?? "item-1",
    audit: overrides.audit ?? false,
    toOneRelations: (overrides.toOne ?? []).map((name) => ({ name })),
    toManyRelations: (overrides.toMany ?? []).map((name) => ({ name })),
  } as unknown as EntityItem;
}

function Harness(props: Partial<Omit<EntityItemSectionsProps, "state">> & { item: EntityItem }) {
  const state = useEntityItemSectionsState();
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

let widthSpy: ReturnType<typeof vi.spyOn> | undefined;
function mockWidth(width: number) {
  widthSpy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ width } as DOMRect);
}

// Captures the observer callbacks, so a test can report a resize; jsdom never does.
let resizeCallbacks: (() => void)[] = [];
function resize(width: number) {
  widthSpy?.mockRestore();
  mockWidth(width);
  act(() => resizeCallbacks.forEach((callback) => callback()));
}

beforeEach(() => {
  resizeCallbacks = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe() {
        resizeCallbacks.push(this.callback);
      }
      disconnect() {
        resizeCallbacks = resizeCallbacks.filter((callback) => callback !== this.callback);
      }
    },
  );
});

afterEach(() => {
  widthSpy?.mockRestore();
  widthSpy = undefined;
  vi.unstubAllGlobals();
});

describe("EntityItemSections", () => {
  it("stacks attributes, relations and audit, with to-one open and to-many collapsed", () => {
    render(<Harness item={makeItem({ toOne: ["customer"], toMany: ["invoices"], audit: true })} />);

    expect(screen.getByText("attributes item-1")).toBeInTheDocument();
    expect(screen.getByText("to-one customer open")).toBeInTheDocument();
    expect(screen.getByText("to-many invoices closed")).toBeInTheDocument();
    expect(screen.getByText("audit trail")).toBeInTheDocument();
    expect(screen.queryByTestId("split")).not.toBeInTheDocument();
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

  it("columns: puts the relations next to attributes and audit when wide enough", () => {
    mockWidth(1000);
    render(<Harness item={makeItem({ toOne: ["customer"], audit: true })} layout="columns" />);

    expect(screen.getByTestId("split-left")).toHaveTextContent("attributes item-1");
    expect(screen.getByTestId("split-left")).toHaveTextContent("audit trail");
    expect(screen.getByTestId("split-right")).toHaveTextContent("to-one customer open");
  });

  it("columns: keeps a single column when too narrow", () => {
    mockWidth(500);
    render(<Harness item={makeItem({ toOne: ["customer"] })} layout="columns" />);

    expect(screen.queryByTestId("split")).not.toBeInTheDocument();
    expect(screen.getByText("to-one customer open")).toBeInTheDocument();
  });

  it("columns: switches layout when resized across the threshold", () => {
    mockWidth(1000);
    render(<Harness item={makeItem({ toOne: ["customer"] })} layout="columns" />);
    expect(screen.getByTestId("split")).toBeInTheDocument();

    resize(500);
    expect(screen.queryByTestId("split")).not.toBeInTheDocument();
  });

  it("columns: holds the layout while editing and catches up afterwards", () => {
    mockWidth(1000);
    const item = makeItem({ toOne: ["customer"] });
    const { rerender } = render(
      <Harness item={item} editedItem={makeItem({ id: "item-1-v1" })} layout="columns" />,
    );
    expect(screen.getByTestId("split")).toBeInTheDocument();

    resize(500);
    expect(screen.getByTestId("split")).toBeInTheDocument();

    rerender(<Harness item={item} editedItem={null} layout="columns" />);
    expect(screen.queryByTestId("split")).not.toBeInTheDocument();
  });

  it("columns: keeps a single column for an item without relations", () => {
    mockWidth(1000);
    render(<Harness item={makeItem()} layout="columns" />);

    expect(screen.queryByTestId("split")).not.toBeInTheDocument();
    expect(screen.getByText("attributes item-1")).toBeInTheDocument();
  });
});

describe("useEntityItemSectionsState", () => {
  it("uses the default until a section is toggled", () => {
    const { result } = renderHook(() => useEntityItemSectionsState());

    expect(result.current.openProps("invoices", false).open).toBe(false);
    act(() => result.current.openProps("invoices", false).onOpenChange(true));
    expect(result.current.openProps("invoices", false).open).toBe(true);
  });

  it("revealRelation expands a relation's section and scrolls its element into view", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const element = document.createElement("section");
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;
    const { result } = renderHook(() => useEntityItemSectionsState());

    act(() => result.current.sectionRef("relation:invoices")(element));
    act(() => result.current.revealRelation("invoices"));

    expect(result.current.openProps("relation:invoices", false).open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    // An unregistered section is opened without scrolling.
    scrollIntoView.mockClear();
    act(() => result.current.sectionRef("relation:invoices")(null));
    act(() => result.current.revealRelation("invoices"));
    expect(scrollIntoView).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});
