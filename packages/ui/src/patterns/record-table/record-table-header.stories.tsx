import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordTableHeader } from "./record-table-header";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table-header";

const meta = {
  title: "Patterns/RecordTableHeader",
  component: RecordTableHeader,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div role="table" className="w-full rounded-md border overflow-hidden">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecordTableHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS: RecordTableColumn[] = [
  { key: "reference", header: "Reference" },
  { key: "supplier", header: "Supplier" },
  { key: "total", header: "Total" },
];

const SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "supplier,asc", property: "supplier", prompt: "Supplier A→Z", direction: "asc" },
  { value: "supplier,desc", property: "supplier", prompt: "Supplier Z→A", direction: "desc" },
];

export const Default: Story = {
  args: {
    columns: COLUMNS,
  },
};

export const WithSort: Story = {
  args: {
    columns: COLUMNS,
    sortOptions: SORT_OPTIONS,
    currentSort: ["supplier,asc"],
    onSort: fn(),
  },
};

const TYPED_COLUMNS: RecordTableColumn[] = [
  { key: "reference", header: "Invoice", sortKind: "text" },
  { key: "amount", header: "Amount", sortKind: "number", align: "end" },
  { key: "issued", header: "Issue date", sortKind: "date" },
  { key: "notes", header: "Notes" },
];

const TYPED_SORT_OPTIONS: RecordTableSortOption[] = [
  { value: "reference,asc", property: "reference", prompt: "Invoice A→Z", direction: "asc" },
  { value: "reference,desc", property: "reference", prompt: "Invoice Z→A", direction: "desc" },
  { value: "amount,asc", property: "amount", prompt: "Amount low→high", direction: "asc" },
  { value: "amount,desc", property: "amount", prompt: "Amount high→low", direction: "desc" },
  { value: "issued,asc", property: "issued", prompt: "Issue date oldest", direction: "asc" },
  { value: "issued,desc", property: "issued", prompt: "Issue date newest", direction: "desc" },
];

/** Sortable headers show two arrows; the sorted one a single arrow in the accent colour. Notes can't be sorted. */
export const SortedColumn: Story = {
  args: {
    columns: TYPED_COLUMNS,
    sortOptions: TYPED_SORT_OPTIONS,
    currentSort: ["amount,asc"],
    onSort: fn(),
  },
};

export const SortedDescending: Story = {
  args: {
    columns: TYPED_COLUMNS,
    sortOptions: TYPED_SORT_OPTIONS,
    currentSort: ["issued,desc"],
    onSort: fn(),
  },
};

export const WithActionsColumn: Story = {
  args: {
    columns: COLUMNS,
    showActionsColumn: true,
  },
};

export const WithSelectionColumn: Story = {
  args: {
    columns: COLUMNS,
    onSelectAll: fn(),
  },
};

export const WithSelectionColumnIndeterminate: Story = {
  args: {
    columns: COLUMNS,
    selectionState: "indeterminate",
    onSelectAll: fn(),
  },
};
