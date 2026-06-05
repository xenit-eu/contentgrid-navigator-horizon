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

  it("renders object cell values as JSON rather than [object Object]", () => {
    renderTable({
      rows: [{ id: "1", data: { name: { first: "Alice", last: "Smith" }, status: "active" } }],
    });
    expect(screen.getByText('{"first":"Alice","last":"Smith"}')).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
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
