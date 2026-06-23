import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterChips } from "./filter-chips";

const meta = {
  title: "Patterns/FilterChips",
  component: FilterChips,
  tags: ["autodocs"],
} satisfies Meta<typeof FilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

const FILTER_PROPERTIES = [
  { name: "status", prompt: "Status", type: "string", options: { inline: ["draft", "paid"] } },
  { name: "number~prefix-match", prompt: "Number", type: "string" },
  { name: "issued_date~greater-than", prompt: "Issued date", type: "date" },
  { name: "issued_date~less-than", prompt: "Issued date", type: "date" },
  { name: "amount.~from", prompt: "Amount", type: "string" },
  { name: "amount.~until", prompt: "Amount", type: "string" },
];

export const SingleChip: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: { status: "paid" },
    onRemoveFilter: fn(),
  },
};

export const MultipleChips: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: { status: "draft", "number~prefix-match": "INV-001" },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const WithDateOperator: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: {
      "issued_date~greater-than": "2024-01-01T00:00:00Z",
      "issued_date~less-than": "2024-12-31T00:00:00Z",
    },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const WithRangePair: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: { "amount.~from": "100", "amount.~until": "500" },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const ManyFilters: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: {
      status: "paid",
      "number~prefix-match": "INV",
      "issued_date~greater-than": "2024-01-01T00:00:00Z",
    },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

// FilterChips returns null for empty filters, so this story renders a blank canvas —
// no pixels to diff against, making visual regression pointless here.
export const NoActiveFilters: Story = {
  tags: ["no-visual-test"],
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: {},
    onRemoveFilter: fn(),
  },
};
