import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordTableHeader } from "./record-table-header";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table-header";

const COLUMNS: RecordTableColumn[] = [
  { key: "name", header: "Name" },
  { key: "status", header: "Status" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "name,asc", property: "name", prompt: "A→Z", direction: "asc" },
  { value: "name,desc", property: "name", prompt: "Z→A", direction: "desc" },
];

function renderHeader(overrides: Partial<Parameters<typeof RecordTableHeader>[0]> = {}) {
  return render(
    <div role="table">
      <RecordTableHeader columns={COLUMNS} {...overrides} />
    </div>,
  );
}

describe("RecordTableHeader — column headers", () => {
  it("renders column headers", () => {
    renderHeader();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders a sort button for a column present in sortOptions, with onSort", () => {
    renderHeader({ sortOptions: SORT_OPTIONS, onSort: vi.fn() });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("does not render a sort button when onSort is absent", () => {
    renderHeader({ sortOptions: SORT_OPTIONS });
    expect(screen.queryByRole("button", { name: /name/i })).not.toBeInTheDocument();
  });

  it("does not render a sort button when sortOptions is absent", () => {
    renderHeader({ onSort: vi.fn() });
    expect(screen.queryByRole("button", { name: /name/i })).not.toBeInTheDocument();
  });

  it("does not render a sort button for a column with no matching sortOptions entry", () => {
    renderHeader({ sortOptions: SORT_OPTIONS, onSort: vi.fn() });
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();
  });

  it("calls onSort with the first sort option when an unsorted column is clicked", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderHeader({ sortOptions: SORT_OPTIONS, onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[0]);
  });

  it("cycles from the active option to the next option in sortOptions order", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderHeader({ sortOptions: SORT_OPTIONS, currentSort: ["name,asc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[1]);
  });

  it("cycles to undefined (cleared) after the last sort option", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderHeader({ sortOptions: SORT_OPTIONS, currentSort: ["name,desc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(undefined);
  });

  it("only reflects the active option belonging to that column, independent of other active sorts", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    // "status" has its own active sort in currentSort, unrelated to "name"'s options.
    renderHeader({ sortOptions: SORT_OPTIONS, currentSort: ["status,asc", "name,asc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[1]);
  });
});

describe("RecordTableHeader — actions column", () => {
  it("reserves an extra header cell when showActionsColumn is true", () => {
    renderHeader({ showActionsColumn: true });
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length + 1);
  });

  it("does not reserve an extra header cell when showActionsColumn is absent", () => {
    renderHeader();
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length);
  });
});
