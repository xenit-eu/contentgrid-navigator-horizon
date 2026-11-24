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

describe("RecordTableHeader — sort tooltip and state", () => {
  const KINDS: [RecordTableColumn["sortKind"], string, string][] = [
    ["text", "Sort A to Z", "Sort Z to A"],
    ["number", "Sort low to high", "Sort high to low"],
    ["date", "Sort oldest first", "Sort newest first"],
  ];

  it.each(KINDS)("names the next sort for a %s column", async (sortKind, first, second) => {
    const user = userEvent.setup();
    const { unmount } = renderHeader({
      columns: [{ key: "name", header: "Name", sortKind }],
      sortOptions: SORT_OPTIONS,
      onSort: vi.fn(),
    });
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText(first)).length).toBeGreaterThan(0);
    unmount();

    renderHeader({
      columns: [{ key: "name", header: "Name", sortKind }],
      sortOptions: SORT_OPTIONS,
      currentSort: ["name,asc"],
      onSort: vi.fn(),
    });
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText(second)).length).toBeGreaterThan(0);
  });

  it('says "Clear sorting" when the next click clears the sort', async () => {
    const user = userEvent.setup();
    renderHeader({ sortOptions: SORT_OPTIONS, currentSort: ["name,desc"], onSort: vi.fn() });
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText("Clear sorting")).length).toBeGreaterThan(0);
  });

  it("falls back to the option's prompt when the column has no sortKind", async () => {
    const user = userEvent.setup();
    renderHeader({ sortOptions: SORT_OPTIONS, onSort: vi.fn() });
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText("A→Z")).length).toBeGreaterThan(0);
  });

  it("marks the sorted column with aria-sort and the accent colour", () => {
    renderHeader({ sortOptions: SORT_OPTIONS, currentSort: ["name,desc"], onSort: vi.fn() });
    const [name, status] = screen.getAllByRole("columnheader");
    expect(name).toHaveAttribute("aria-sort", "descending");
    expect(name).toHaveClass("text-primary");
    expect(status).not.toHaveAttribute("aria-sort");
    expect(status).not.toHaveClass("text-primary");
  });

  it("right-aligns the header of an end-aligned column", () => {
    renderHeader({ columns: [{ key: "total", header: "Total", align: "end" }] });
    expect(screen.getByRole("columnheader")).toHaveClass("text-right");
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

  it("pins the trailing actions header cell to the right with an opaque background", () => {
    renderHeader({ showActionsColumn: true });
    const headers = screen.getAllByRole("columnheader");
    expect(headers.at(-1)).toHaveClass("sticky", "right-0", "bg-table-header");
  });
});

describe("RecordTableHeader — selection column", () => {
  it("reserves a leading header cell with a checkbox when onSelectAll is provided", () => {
    renderHeader({ onSelectAll: vi.fn() });
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length + 1);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("does not reserve a selection column when onSelectAll is absent", () => {
    renderHeader();
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
