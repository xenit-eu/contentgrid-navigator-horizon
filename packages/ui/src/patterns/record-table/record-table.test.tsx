import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordTable } from "./record-table";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table";

const COLUMNS: RecordTableColumn[] = [
  { key: "name", header: "Name" },
  { key: "status", header: "Status" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "name,asc", property: "name", prompt: "A→Z", direction: "asc" },
  { value: "name,desc", property: "name", prompt: "Z→A", direction: "desc" },
];

function renderTable(overrides: Partial<Parameters<typeof RecordTable>[0]> = {}) {
  return render(
    <RecordTable entityName="user" columns={COLUMNS} {...overrides}>
      {overrides.children ?? <div role="row">Alice</div>}
    </RecordTable>,
  );
}

describe("RecordTable — column headers", () => {
  it("renders column headers", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders a sort button for a column present in sortOptions, with onSort", () => {
    renderTable({ sortOptions: SORT_OPTIONS, onSort: vi.fn() });
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
  });

  it("does not render a sort button when onSort is absent", () => {
    renderTable({ sortOptions: SORT_OPTIONS });
    expect(screen.queryByRole("button", { name: /name/i })).not.toBeInTheDocument();
  });

  it("does not render a sort button when sortOptions is absent", () => {
    renderTable({ onSort: vi.fn() });
    expect(screen.queryByRole("button", { name: /name/i })).not.toBeInTheDocument();
  });

  it("does not render a sort button for a column with no matching sortOptions entry", () => {
    renderTable({ sortOptions: SORT_OPTIONS, onSort: vi.fn() });
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();
  });

  it("calls onSort with the first sort option when an unsorted column is clicked", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderTable({ sortOptions: SORT_OPTIONS, onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[0]);
  });

  it("cycles from the active option to the next option in sortOptions order", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderTable({ sortOptions: SORT_OPTIONS, currentSort: ["name,asc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[1]);
  });

  it("cycles to undefined (cleared) after the last sort option", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderTable({ sortOptions: SORT_OPTIONS, currentSort: ["name,desc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(undefined);
  });

  it("only reflects the active option belonging to that column, independent of other active sorts", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    // "status" has its own active sort in currentSort, unrelated to "name"'s options.
    renderTable({ sortOptions: SORT_OPTIONS, currentSort: ["status,asc", "name,asc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[1]);
  });
});

describe("RecordTable — rows", () => {
  it("renders row children", () => {
    renderTable({ children: <div role="row">Alice</div> });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders multiple row children", () => {
    renderTable({
      children: [
        <div role="row" key="1">
          Alice
        </div>,
        <div role="row" key="2">
          Bob
        </div>,
      ],
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});

describe("RecordTable — actions column", () => {
  it("reserves an extra header cell when showActionsColumn is true", () => {
    renderTable({ showActionsColumn: true });
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length + 1);
  });

  it("does not reserve an extra header cell when showActionsColumn is absent", () => {
    renderTable();
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length);
  });
});

describe("RecordTable — table actions", () => {
  it("renders tableActions when provided", () => {
    renderTable({ tableActions: <button type="button">Export</button> });
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("does not render a table actions region when tableActions is absent", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });
});

describe("RecordTable — empty state", () => {
  it("renders empty state when there are no row children", () => {
    renderTable({ children: [], entityTitle: "Users" });
    expect(screen.getByText("No Users found")).toBeInTheDocument();
  });

  it("falls back to entityName when entityTitle is omitted", () => {
    renderTable({ children: [], entityName: "user" });
    expect(screen.getByText("No user found")).toBeInTheDocument();
  });

  it("does not render a create button when onCreateClick is omitted", () => {
    renderTable({ children: [] });
    expect(screen.queryByRole("button", { name: /add new item/i })).not.toBeInTheDocument();
  });

  it("renders a create button when onCreateClick is provided", () => {
    renderTable({ children: [], onCreateClick: vi.fn() });
    expect(screen.getByRole("button", { name: /add new item/i })).toBeInTheDocument();
  });

  it("calls onCreateClick when the create button is clicked", async () => {
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    renderTable({ children: [], onCreateClick });
    await user.click(screen.getByRole("button", { name: /add new item/i }));
    expect(onCreateClick).toHaveBeenCalled();
  });
});

describe("RecordTable — pagination", () => {
  it("does not render pagination controls when neither handler is provided", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("enables Next and disables Previous when only onNextPageClick is provided", () => {
    renderTable({ onNextPageClick: vi.fn() });
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("enables Previous and disables Next when only onPreviousPageClick is provided", () => {
    renderTable({ onPreviousPageClick: vi.fn() });
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("calls onNextPageClick when Next is clicked", async () => {
    const user = userEvent.setup();
    const onNextPageClick = vi.fn();
    renderTable({ onNextPageClick });
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onNextPageClick).toHaveBeenCalled();
  });

  it("calls onPreviousPageClick when Previous is clicked", async () => {
    const user = userEvent.setup();
    const onPreviousPageClick = vi.fn();
    renderTable({ onPreviousPageClick });
    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPreviousPageClick).toHaveBeenCalled();
  });
});
