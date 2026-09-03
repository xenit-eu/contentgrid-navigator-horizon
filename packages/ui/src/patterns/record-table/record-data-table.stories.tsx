import type { ReactNode } from "react";
import { DotsThreeIcon as DotsThree } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "../../primitives/button";
import { RecordDataTable } from "./record-data-table";
import type { RecordTableSortOption } from "./record-table-header";
import { RecordTableRow } from "./table-row";

const meta = {
  title: "Patterns/RecordDataTable",
  component: RecordDataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof RecordDataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { key: "reference", header: "Reference" },
  { key: "supplier", header: "Supplier" },
  { key: "total", header: "Total" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "supplier,asc", property: "supplier", prompt: "Supplier A→Z", direction: "asc" },
  { value: "supplier,desc", property: "supplier", prompt: "Supplier Z→A", direction: "desc" },
  { value: "total,asc", property: "total", prompt: "Total low→high", direction: "asc" },
  { value: "total,desc", property: "total", prompt: "Total high→low", direction: "desc" },
];

const ROWS = [
  {
    reference: "INV-2024-0042",
    supplier: "Acme Corporation",
    total: "€ 12,450.00",
  },
  {
    reference: "IMG-2024-0017",
    supplier: "Beta Supplies",
    total: "€ 540.00",
  },
  {
    reference: "DOC-2024-0008",
    supplier: "Gamma Services",
    total: "€ 8,200.00",
  },
];

function buildRows(actions?: (reference: string) => ReactNode) {
  return ROWS.map((row) => (
    <RecordTableRow
      key={row.reference}
      cells={[
        { key: "reference", content: row.reference },
        { key: "supplier", content: row.supplier },
        { key: "total", content: row.total, align: "end" },
      ]}
      actions={actions?.(row.reference)}
    />
  ));
}

function buildManyRows(count: number) {
  return Array.from({ length: count }, (_, i) => (
    <RecordTableRow
      key={i}
      cells={[
        { key: "reference", content: `INV-2024-${String(i).padStart(4, "0")}` },
        { key: "supplier", content: `Supplier ${i + 1}` },
        { key: "total", content: `€ ${(i + 1) * 100}.00`, align: "end" },
      ]}
    />
  ));
}

export const Default: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    children: buildRows(),
  },
};

export const WithSort: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    sortOptions: SORT_OPTIONS,
    currentSort: ["supplier,asc"],
    onSort: fn(),
    children: buildRows(),
  },
};

export const WithTableActions: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    tableActions: (
      <Button variant="outline" size="sm">
        Export
      </Button>
    ),
    children: buildRows(),
  },
};

export const WithRowActions: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    showActionsColumn: true,
    // Only the first row has a delete permission in this example — modeling per-item ABAC.
    children: buildRows((reference) =>
      reference === "INV-2024-0042" ? (
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <DotsThree className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      ) : undefined,
    ),
  },
};

export const WithPagination: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    onNextPageClick: fn(),
    onPreviousPageClick: undefined,
    children: buildRows(),
  },
};

export const WithFooterItemCount: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    footerContent: "Showing 3 of ~42 items",
    onNextPageClick: fn(),
    onPreviousPageClick: undefined,
    children: buildRows(),
  },
};

export const Empty: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    children: [],
  },
};

export const EmptyWithCreate: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    onCreateClick: fn(),
    children: [],
  },
};

/**
 * Demonstrates the scrollable layout: given a bounded height via `className`, the column
 * header and Previous/Next footer stay pinned while only the row list scrolls.
 */
export const ScrollableWithFixedHeight: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    className: "h-96",
    onNextPageClick: fn(),
    onPreviousPageClick: fn(),
    children: buildManyRows(40),
  },
};
