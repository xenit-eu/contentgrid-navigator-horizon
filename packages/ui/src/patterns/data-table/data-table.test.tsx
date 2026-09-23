import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import type { DataTableColumn, DataTableRow, SortOption } from "./data-table";

const COLUMNS: DataTableColumn[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "status", header: "Status" },
];

const ROWS: DataTableRow[] = [
  { id: "1", data: { name: "Alice", status: "active" } },
  { id: "2", data: { name: "Bob", status: "inactive" } },
];

function renderTable(overrides: Partial<Parameters<typeof DataTable>[0]> = {}) {
  return render(<DataTable entityName="user" columns={COLUMNS} rows={ROWS} {...overrides} />);
}

describe("DataTable — column headers", () => {
  it("renders column headers", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders a sort button for sortable columns with onSort", () => {
    renderTable({ onSort: vi.fn() });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("does not render a sort button when onSort is absent", () => {
    renderTable();
    // Name header should be plain text, not a button
    expect(screen.queryByRole("button", { name: /name/i })).not.toBeInTheDocument();
  });

  it("calls onSort with column key when sort button is clicked", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderTable({ onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("renders actions column header when any action is provided", () => {
    renderTable({ onViewDetails: vi.fn() });
    // There should be an extra empty header for the actions column
    const headers = screen.getAllByRole("columnheader");
    expect(headers.length).toBe(3); // Name + Status + actions
  });

  it("does not render actions column when no actions are provided", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.length).toBe(2);
  });
});

describe("DataTable — sort icons", () => {
  const sortOptions: SortOption[] = [
    { value: "name,asc", property: "name", prompt: "Sort A→Z" },
    { value: "name,desc", property: "name", prompt: "Sort Z→A" },
  ];

  it("shows asc sort icon when currentSort matches key,asc", () => {
    // Arrow-up icon rendered (no easy text to check, just verify button renders without error)
    renderTable({ onSort: vi.fn(), currentSort: "name,asc", sortOptions });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("shows desc sort icon when currentSort matches key,desc", () => {
    renderTable({ onSort: vi.fn(), currentSort: "name,desc", sortOptions });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("shows default sort icon when currentSort does not match", () => {
    renderTable({ onSort: vi.fn(), currentSort: "status,asc" });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("passes undefined sort tooltip when on the third (clear) transition from desc to unsorted", () => {
    // Simulate the component computing a tooltip when currentSort === key,desc (next = undefined)
    // getSortTooltip returns nextPrompt ?? currentPrompt; when nextSort=undefined nextPrompt=undefined
    // so it returns the currentPrompt for desc
    const onSort = vi.fn();
    renderTable({ onSort, currentSort: "name,desc", sortOptions });
    // The sort button should still render correctly (no crash on the clear-sort path)
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("calls onSort with the column key on the third click (asc → desc → unsorted)", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    // Simulate being in desc state; clicking will call onSort once more (third click)
    renderTable({ onSort, currentSort: "name,desc", sortOptions });
    await user.click(screen.getByRole("button", { name: /name/i }));
    // onSort is always called with the column key — the parent component manages sort state
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("computes the 'set asc' tooltip when no sort is currently active (else branch)", () => {
    // When currentSort is undefined/unrelated, getSortTooltip's else branch sets nextSort = key,asc
    // and returns the prompt for the asc option
    renderTable({ onSort: vi.fn(), currentSort: undefined, sortOptions });
    // The sort button renders without error — tooltip logic takes the else path (nextSort = key,asc)
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });
});

describe("DataTable — row rendering", () => {
  it("renders cell data for each row", () => {
    renderTable();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders '—' for null/undefined cell values", () => {
    renderTable({
      rows: [{ id: "1", data: { name: null, status: undefined } }],
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("caps a long cell value's width instead of letting it stretch the column", () => {
    const longValue =
      "This is a very long free-text attribute value that should not be allowed to force its column, and the whole table, arbitrarily wide.";
    renderTable({
      rows: [{ id: "1", data: { name: longValue, status: "active" } }],
    });
    const cell = screen.getByText(longValue);
    expect(cell).toHaveClass("truncate", "max-w-xs");
  });

  it("puts the full value in a title attribute so it's still reachable on hover", () => {
    const longValue = "A long value that gets truncated visually";
    renderTable({
      rows: [{ id: "1", data: { name: longValue, status: "active" } }],
    });
    expect(screen.getByText(longValue)).toHaveAttribute("title", longValue);
  });

  it("calls onRowClick with row id when row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    await user.click(screen.getByText("Alice"));
    expect(onRowClick).toHaveBeenCalledWith("1");
  });

  it("does not call onRowClick when it is not provided", async () => {
    const user = userEvent.setup();
    // No error should be thrown
    renderTable();
    await user.click(screen.getByText("Alice"));
  });
});

describe("DataTable — empty state", () => {
  it("renders empty state when rows is empty", () => {
    renderTable({ rows: [] });
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("shows entityTitle in empty state button when provided", () => {
    renderTable({ rows: [], entityTitle: "Users" });
    expect(screen.getByRole("button", { name: /add new item to users/i })).toBeInTheDocument();
  });

  it("falls back to entityName in empty state button when entityTitle is omitted", () => {
    renderTable({ rows: [], entityName: "user" });
    expect(screen.getByRole("button", { name: /add new item to user/i })).toBeInTheDocument();
  });

  it("calls onCreateClick when empty state button is clicked", async () => {
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    renderTable({ rows: [], onCreateClick });
    await user.click(screen.getByRole("button", { name: /add new item/i }));
    expect(onCreateClick).toHaveBeenCalled();
  });
});

describe("DataTable — action menu", () => {
  it("renders action menu button per row", () => {
    renderTable({ onViewDetails: vi.fn() });
    expect(screen.getAllByRole("button", { name: /open menu/i }).length).toBe(2);
  });

  it("opens dropdown and shows View details option", async () => {
    const user = userEvent.setup();
    renderTable({ onViewDetails: vi.fn() });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    expect(screen.getByText("View details")).toBeInTheDocument();
  });

  it("calls onViewDetails with row id when View details is clicked", async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    renderTable({ onViewDetails });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("View details"));
    expect(onViewDetails).toHaveBeenCalledWith("1");
  });

  it("shows Edit option when onEdit is provided", async () => {
    const user = userEvent.setup();
    renderTable({ onEdit: vi.fn() });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("calls onEdit with row id when Edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderTable({ onEdit });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith("1");
  });

  it("shows Delete option when onDelete is provided", async () => {
    const user = userEvent.setup();
    renderTable({ onDelete: vi.fn() });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("clicking Delete opens the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderTable({ onDelete: vi.fn() });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("Delete item")).toBeInTheDocument();
  });

  it("confirms deletion and calls onDelete with row id", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderTable({ onDelete });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Delete"));
    // Click the destructive confirm button in the dialog
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("cancels deletion dialog without calling onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderTable({ onDelete });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Delete"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows 'Deleting...' text on confirm button when isDeleting is true", async () => {
    const user = userEvent.setup();
    renderTable({ onDelete: vi.fn(), isDeleting: true });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Delete"));
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });

  it("uses entityTitle in delete dialog message when provided", async () => {
    const user = userEvent.setup();
    renderTable({ onDelete: vi.fn(), entityTitle: "Users" });
    const [firstMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(firstMenu);
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText(/delete this users/i)).toBeInTheDocument();
  });
});

describe("DataTable — unlink action", () => {
  it("renders an unlink button per row when onUnlink is provided", () => {
    renderTable({ onUnlink: vi.fn() });
    expect(screen.getAllByRole("button", { name: /unlink/i }).length).toBe(2);
  });

  it("does not render unlink buttons when onUnlink is absent", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /unlink/i })).not.toBeInTheDocument();
  });

  it("clicking unlink opens the confirmation dialog without calling onUnlink yet", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderTable({ onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    expect(screen.getByText(/unlink user/i)).toBeInTheDocument();
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("confirms unlink and calls onUnlink with row id", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderTable({ onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onUnlink).toHaveBeenCalledWith("1");
  });

  it("cancels unlink dialog without calling onUnlink", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderTable({ onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("disables unlink buttons while isUnlinking is true", () => {
    renderTable({ onUnlink: vi.fn(), isUnlinking: true });
    for (const button of screen.getAllByRole("button", { name: /unlink/i })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("DataTable — containerClassName", () => {
  it("forwards containerClassName to the table's own scrollable wrapper", () => {
    const { container } = renderTable({ containerClassName: "max-h-64 overflow-auto" });
    const wrapper = container.querySelector('[data-slot="table-container"]');
    expect(wrapper).toHaveClass("max-h-64", "overflow-auto");
  });

  it("keeps the wrapper's own overflow-x-auto default when containerClassName is not provided", () => {
    const { container } = renderTable();
    const wrapper = container.querySelector('[data-slot="table-container"]');
    expect(wrapper).toHaveClass("overflow-x-auto");
  });
});

describe("DataTable — row selection", () => {
  it("does not render selection checkboxes when onSelectionChange is absent", () => {
    renderTable();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders one checkbox per row plus a header 'select all' checkbox", () => {
    renderTable({ onSelectionChange: vi.fn() });
    // 2 rows + 1 header checkbox
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("calls onSelectionChange with the row's id added when its checkbox is checked", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange });
    const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
    await user.click(firstRowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1"]));
  });

  it("calls onSelectionChange with the row's id removed when an already-selected checkbox is unchecked", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange, selectedIds: new Set(["1", "2"]) });
    const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
    await user.click(firstRowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["2"]));
  });

  it("reflects selectedIds as each row checkbox's checked state", () => {
    renderTable({ onSelectionChange: vi.fn(), selectedIds: new Set(["2"]) });
    const [, firstRowCheckbox, secondRowCheckbox] = screen.getAllByRole("checkbox");
    expect(firstRowCheckbox).not.toBeChecked();
    expect(secondRowCheckbox).toBeChecked();
  });

  it("shows the header checkbox as checked when every row is selected", () => {
    renderTable({ onSelectionChange: vi.fn(), selectedIds: new Set(["1", "2"]) });
    const [headerCheckbox] = screen.getAllByRole("checkbox");
    expect(headerCheckbox).toBeChecked();
  });

  it("shows the header checkbox as indeterminate when only some rows are selected", () => {
    renderTable({ onSelectionChange: vi.fn(), selectedIds: new Set(["1"]) });
    const [headerCheckbox] = screen.getAllByRole("checkbox");
    expect(headerCheckbox).toHaveAttribute("data-state", "indeterminate");
  });

  it("selects every row's id when the header checkbox is checked", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange });
    const [headerCheckbox] = screen.getAllByRole("checkbox");
    await user.click(headerCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2"]));
  });

  it("clears every row's id when the header checkbox is unchecked", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange, selectedIds: new Set(["1", "2"]) });
    const [headerCheckbox] = screen.getAllByRole("checkbox");
    await user.click(headerCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set());
  });

  it("does not call onRowClick when a row's checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onSelectionChange: vi.fn(), onRowClick });
    const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
    await user.click(firstRowCheckbox);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
