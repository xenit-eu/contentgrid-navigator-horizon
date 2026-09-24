import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordDataTable } from "../record-table/record-data-table";
import { RecordTableRow } from "../record-table/table-row";
import { RelationToManyRenderer } from "./relation-to-many-renderer";
import { relationToManyField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/RelationToManyRenderer",
  component: RelationToManyRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof RelationToManyRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "sku", header: "SKU" },
];
const LINKED_TABLE = (
  <RecordDataTable entityName="product" entityTitle="Products" columns={COLUMNS}>
    <RecordTableRow
      cells={[
        { key: "name", content: "Widget A" },
        { key: "sku", content: "WA-001" },
      ]}
    />
    <RecordTableRow
      cells={[
        { key: "name", content: "Widget B" },
        { key: "sku", content: "WB-002" },
      ]}
    />
  </RecordDataTable>
);

export const Empty: Story = {
  args: {
    ...relationToManyField(),
    onLink: fn(),
  },
};

export const WithLinkedItems: Story = {
  args: {
    ...relationToManyField({ count: 2, children: LINKED_TABLE }),
    onLink: fn(),
    onClear: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    ...relationToManyField({ readOnly: true, count: 2, children: LINKED_TABLE }),
    onLink: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...relationToManyField({ error: "At least one product is required" }),
    onLink: fn(),
  },
};
