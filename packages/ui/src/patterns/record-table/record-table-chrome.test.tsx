import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordDataTable } from "./record-data-table";
import { RecordTableHeader } from "./record-table-header";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table-header";
import { RecordTableRow } from "./table-row";

const COLUMNS: RecordTableColumn[] = [{ key: "name", header: "Name" }];
const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "name,asc", property: "name", prompt: "A→Z", direction: "asc" },
  { value: "name,desc", property: "name", prompt: "Z→A", direction: "desc" },
];

function renderHeader(
  chrome: "default" | "collection" | undefined,
  extra: Partial<Parameters<typeof RecordTableHeader>[0]> = {},
) {
  return render(
    <div role="table">
      <RecordTableHeader columns={COLUMNS} chrome={chrome} {...extra} />
    </div>,
  );
}

describe("RecordTableHeader chrome", () => {
  it("renders the compact header by default", () => {
    renderHeader(undefined, {
      sortOptions: SORT_OPTIONS,
      currentSort: ["name,asc"],
      onSort: vi.fn(),
    });
    const row = screen.getByRole("row");
    expect(row).toHaveClass("gap-3", "px-4", "py-2");
    expect(row).not.toHaveClass("h-[38px]");
    const header = screen.getByRole("columnheader");
    expect(header).toHaveClass("text-[13px]", "font-medium");
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(header).not.toHaveClass("text-primary");
  });

  it("shows the sort option's own prompt in the default tooltip, and none when the next click clears", async () => {
    const user = userEvent.setup();
    renderHeader(undefined, {
      columns: [{ key: "name", header: "Name", sortKind: "text", align: "end" }],
      sortOptions: SORT_OPTIONS,
      onSort: vi.fn(),
    });
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText("A→Z")).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader")).not.toHaveClass("text-right");
  });

  it("renders the collection header with sort state, accent colour and typed tooltips", async () => {
    const user = userEvent.setup();
    renderHeader("collection", {
      columns: [{ key: "name", header: "Name", sortKind: "text" }],
      sortOptions: SORT_OPTIONS,
      currentSort: ["name,desc"],
      onSort: vi.fn(),
    });
    expect(screen.getByRole("row")).toHaveClass("h-[38px]", "gap-7", "px-3.5");
    const header = screen.getByRole("columnheader");
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(header).toHaveClass("text-primary", "text-[12.5px]", "font-semibold");
    await user.hover(screen.getByRole("button", { name: /name/i }));
    expect((await screen.findAllByText("Clear sorting")).length).toBeGreaterThan(0);
  });

  it("right-aligns an end-aligned column in the collection header only", () => {
    renderHeader("collection", { columns: [{ key: "t", header: "Total", align: "end" }] });
    expect(screen.getByRole("columnheader")).toHaveClass("text-right");
  });
});

describe("RecordTableRow chrome", () => {
  const cells = [{ key: "name", content: "Acme" }];

  it("renders the compact row by default", () => {
    render(<RecordTableRow cells={cells} />);
    const row = screen.getByRole("row");
    expect(row).toHaveClass("gap-3", "px-4", "py-3");
    expect(row).not.toHaveClass("min-h-11");
    expect(row).not.toHaveClass("last:border-b-0");
  });

  it("renders the collection row when opted in", () => {
    render(<RecordTableRow cells={cells} chrome="collection" />);
    expect(screen.getByRole("row")).toHaveClass(
      "min-h-11",
      "gap-7",
      "px-3.5",
      "py-2",
      "last:border-b-0",
    );
  });
});

describe("RecordDataTable chrome", () => {
  function renderTable(chrome?: "default" | "collection", footerContent?: string) {
    return render(
      <RecordDataTable
        entityName="invoice"
        columns={COLUMNS}
        chrome={chrome}
        onNextPageClick={vi.fn()}
        footerContent={footerContent}
      >
        <RecordTableRow cells={[{ key: "name", content: "Acme" }]} chrome={chrome} />
      </RecordDataTable>,
    );
  }

  it("keeps the default footer: muted bar, Previous and Next spread to both ends", () => {
    renderTable();
    const previous = screen.getByRole("button", { name: /previous/i });
    expect(previous.parentElement).toHaveClass("w-full", "justify-between");
    expect(previous.parentElement).not.toHaveClass("ml-auto");
    expect(previous.parentElement?.parentElement).toHaveClass("bg-muted/70", "p-2");
  });

  it("keeps Previous and Next beside the default footer's text", () => {
    renderTable(undefined, "Showing 1 of 1 items");
    const previous = screen.getByRole("button", { name: /previous/i });
    expect(screen.getByText("Showing 1 of 1 items")).toBeInTheDocument();
    expect(previous.parentElement).not.toHaveClass("w-full");
  });

  it("renders the collection footer bar with Previous and Next at the right when opted in", () => {
    renderTable("collection");
    const previous = screen.getByRole("button", { name: /previous/i });
    expect(previous.parentElement).toHaveClass("ml-auto");
    expect(previous.parentElement).not.toHaveClass("w-full");
    expect(previous.parentElement?.parentElement).toHaveClass(
      "bg-table-header",
      "px-3.5",
      "py-2.5",
    );
  });

  it("hands the chrome to the header", () => {
    renderTable("collection");
    expect(screen.getAllByRole("row")[0]).toHaveClass("h-[38px]");
  });
});
