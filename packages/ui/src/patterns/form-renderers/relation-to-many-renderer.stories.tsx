import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
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
const ROWS = [
  { id: "https://api.example.com/products/1", data: { name: "Widget A", sku: "WA-001" } },
  { id: "https://api.example.com/products/2", data: { name: "Widget B", sku: "WB-002" } },
];

export const Empty: Story = {
  args: {
    ...relationToManyField(),
    onLinkMore: fn(),
  },
};

export const WithLinkedItems: Story = {
  args: {
    ...relationToManyField({ columns: COLUMNS, rows: ROWS }),
    onLinkMore: fn(),
    onUnlinkAll: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    ...relationToManyField({ readOnly: true, columns: COLUMNS, rows: ROWS }),
    onLinkMore: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...relationToManyField({ error: "At least one product is required" }),
    onLinkMore: fn(),
  },
};
