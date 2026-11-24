import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordDataTable } from "./record-data-table";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table-header";

const COLUMNS: RecordTableColumn[] = [
  { key: "name", header: "Name" },
  { key: "status", header: "Status" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "name,asc", property: "name", prompt: "A→Z", direction: "asc" },
  { value: "name,desc", property: "name", prompt: "Z→A", direction: "desc" },
];

function renderTable(overrides: Partial<Parameters<typeof RecordDataTable>[0]> = {}) {
  return render(
    <RecordDataTable entityName="user" columns={COLUMNS} {...overrides}>
      {overrides.children ?? <div role="row">Alice</div>}
    </RecordDataTable>,
  );
}

describe("RecordDataTable — header delegation", () => {
  it("renders column headers via RecordTableHeader", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("wires sortOptions/currentSort/onSort through to the header's sort button", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderTable({ sortOptions: SORT_OPTIONS, currentSort: ["name,asc"], onSort });
    await user.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith(SORT_OPTIONS[1]);
  });
});

describe("RecordDataTable — rows", () => {
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

  it("renders the row list in a scrollable region separate from the header", () => {
    renderTable({ children: <div role="row">Alice</div> });
    const rowgroups = screen.getAllByRole("rowgroup");
    // Header rowgroup (from RecordTableHeader) + body rowgroup (the scrollable one).
    expect(rowgroups).toHaveLength(2);
    expect(rowgroups[1]).toHaveClass("overflow-auto");
  });

  it("syncs the header's horizontal scroll position to the body's on scroll", () => {
    const { container } = renderTable({ children: <div role="row">Alice</div> });
    const table = container.querySelector('[role="table"]') as HTMLElement;
    const headerWrapper = table.firstElementChild as HTMLElement;
    const rowgroup = screen.getAllByRole("rowgroup")[1];

    expect(headerWrapper).toHaveClass("overflow-x-hidden", "shrink-0");
    expect(headerWrapper.scrollLeft).toBe(0);

    Object.defineProperty(rowgroup, "scrollLeft", { value: 120, writable: true });
    rowgroup.dispatchEvent(new Event("scroll", { bubbles: false }));

    expect(headerWrapper.scrollLeft).toBe(120);
  });
});

describe("RecordDataTable — actions column", () => {
  it("reserves an extra header cell when showActionsColumn is true", () => {
    renderTable({ showActionsColumn: true });
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length + 1);
  });

  it("does not reserve an extra header cell when showActionsColumn is absent", () => {
    renderTable();
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length);
  });
});

describe("RecordDataTable — table actions", () => {
  it("renders tableActions when provided", () => {
    renderTable({ tableActions: <button type="button">Export</button> });
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("does not render a table actions region when tableActions is absent", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });
});

describe("RecordDataTable — empty state", () => {
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

describe("RecordDataTable — pagination", () => {
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

  it("renders the footer bar for footerContent alone, with both nav buttons disabled", () => {
    renderTable({ footerContent: "Showing 5 of 5 items" });
    expect(screen.getByText("Showing 5 of 5 items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("renders footerContent alongside pagination controls", () => {
    renderTable({ footerContent: "Showing 20 of ~100 items", onNextPageClick: vi.fn() });
    expect(screen.getByText("Showing 20 of ~100 items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });
});

describe("RecordDataTable — footer layout", () => {
  it("renders no item-count text without footerContent, with Previous and Next together at the right", () => {
    renderTable({ onNextPageClick: vi.fn() });
    const previous = screen.getByRole("button", { name: /previous/i });
    expect(previous.parentElement).toHaveClass("ml-auto");
    expect(previous.parentElement).toContainElement(screen.getByRole("button", { name: /next/i }));
    expect(previous.parentElement?.parentElement).not.toHaveTextContent(/showing/i);
  });
});

describe("RecordDataTable — page scroll", () => {
  it("keeps its own scrolling by default: no sticky header, the rows scroll in both directions", () => {
    renderTable();
    expect(screen.getByRole("table").firstElementChild).not.toHaveClass("sticky");
    expect(screen.getAllByRole("rowgroup")[1]).toHaveClass("overflow-auto");
  });

  it("sticks the header and scrolls the rows sideways only when the page scrolls", () => {
    renderTable({ pageScroll: true });
    expect(screen.getByRole("table").firstElementChild).toHaveClass("sticky");
    const rows = screen.getAllByRole("rowgroup")[1];
    expect(rows).toHaveClass("overflow-x-auto", "overflow-y-hidden");
    expect(rows).not.toHaveClass("overflow-auto");
  });

  it("clips the frame's corners without making it a scroll container", () => {
    const { container } = renderTable({ pageScroll: true });
    expect(container.querySelector(".rounded-md.border")).toHaveClass("overflow-clip");
  });

  it("sticks flush at the top of a padded scroller by cancelling that padding", () => {
    render(
      <div style={{ overflowY: "auto", paddingTop: "24px" }}>
        <RecordDataTable entityName="user" columns={COLUMNS} pageScroll>
          <div role="row">Alice</div>
        </RecordDataTable>
      </div>,
    );
    expect(screen.getByRole("table").firstElementChild).toHaveStyle({ top: "-24px" });
  });
});
