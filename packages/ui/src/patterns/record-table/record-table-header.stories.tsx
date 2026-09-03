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

export const WithActionsColumn: Story = {
  args: {
    columns: COLUMNS,
    showActionsColumn: true,
  },
};
