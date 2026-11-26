import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordDataTable } from "./record-data-table";
import {
  type RecordTableColumn,
  RecordTableHeader,
  type RecordTableSortOption,
} from "./record-table-header";
import { RecordTableRow } from "./table-row";

/** The collection page's look (`chrome="collection"`); the stories next door show the default. */
const meta = {
  title: "Patterns/RecordTableCollectionChrome",
  component: RecordDataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof RecordDataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS: RecordTableColumn[] = [
  { key: "reference", header: "Invoice", sortKind: "text" },
  { key: "amount", header: "Amount", sortKind: "number", align: "end" },
  { key: "issued", header: "Issue date", sortKind: "date" },
  { key: "notes", header: "Notes" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "reference,asc", property: "reference", prompt: "Invoice A→Z", direction: "asc" },
  { value: "reference,desc", property: "reference", prompt: "Invoice Z→A", direction: "desc" },
  { value: "amount,asc", property: "amount", prompt: "Amount low→high", direction: "asc" },
  { value: "amount,desc", property: "amount", prompt: "Amount high→low", direction: "desc" },
  { value: "issued,asc", property: "issued", prompt: "Issue date oldest", direction: "asc" },
  { value: "issued,desc", property: "issued", prompt: "Issue date newest", direction: "desc" },
];

const ROWS = [
  ["INV-2024-0042", "€ 12,450.00", "2024-03-01", "Paid"],
  ["INV-2024-0043", "€ 540.00", "2024-03-04", "Open"],
  ["INV-2024-0044", "€ 8,200.00", "2024-03-09", "Open"],
];

function buildRows() {
  return ROWS.map(([reference, amount, issued, notes]) => (
    <RecordTableRow
      key={reference}
      chrome="collection"
      cells={[
        { key: "reference", content: reference },
        { key: "amount", content: amount, align: "end" },
        { key: "issued", content: issued },
        { key: "notes", content: notes },
      ]}
    />
  ));
}

const tableArgs = {
  chrome: "collection",
  entityName: "invoice",
  entityTitle: "Invoices",
  columns: COLUMNS,
  children: buildRows(),
} as const;

export const Default: Story = { args: tableArgs };

export const WithSort: Story = {
  args: { ...tableArgs, sortOptions: SORT_OPTIONS, currentSort: ["amount,asc"], onSort: fn() },
};

export const WithPagination: Story = {
  args: { ...tableArgs, onNextPageClick: fn(), onPreviousPageClick: undefined },
};

export const WithFooterItemCount: Story = {
  args: {
    ...tableArgs,
    footerContent: "Showing 3 of ~42 items",
    onNextPageClick: fn(),
    onPreviousPageClick: undefined,
  },
};

function HeaderOnly({ currentSort }: Readonly<{ currentSort: string }>) {
  return (
    <div role="table" className="w-full overflow-hidden rounded-md border">
      <RecordTableHeader
        chrome="collection"
        columns={COLUMNS}
        sortOptions={SORT_OPTIONS}
        currentSort={[currentSort]}
        onSort={fn()}
      />
    </div>
  );
}

/** Sortable headers show two arrows; the sorted one a single arrow in the accent colour. Notes can't be sorted. */
export const HeaderSortedColumn: Story = {
  args: tableArgs,
  render: () => <HeaderOnly currentSort="amount,asc" />,
};

export const HeaderSortedDescending: Story = {
  args: tableArgs,
  render: () => <HeaderOnly currentSort="issued,desc" />,
};
