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

// Operator suffixes match the platform's actual `blueprint:search-param` name suffixes
// (~prefix, ~after, ~before, ~from, ~until, …) — see the committed profile dump and
// SearchHalFormTemplate.extractSearchType in @contentgrid/navigator-data. There is no
// dot-prefixed "range-pair" naming on this platform.
const FILTER_PROPERTIES = [
  { name: "status", prompt: "Status", type: "text", options: { inline: ["draft", "paid"] } },
  { name: "number~prefix", prompt: "Number", type: "text" },
  { name: "issued_date~after", prompt: "Issued date", type: "datetime" },
  { name: "issued_date~before", prompt: "Issued date", type: "datetime" },
  { name: "amount~from", prompt: "Amount", type: "text" },
  { name: "amount~until", prompt: "Amount", type: "text" },
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
    filters: { status: "draft", "number~prefix": "INV-001" },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const WithDateOperator: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: {
      "issued_date~after": "2024-01-01T00:00:00Z",
      "issued_date~before": "2024-12-31T00:00:00Z",
    },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const WithFromUntilPair: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: { "amount~from": "100", "amount~until": "500" },
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
};

export const ManyFilters: Story = {
  args: {
    filterProperties: FILTER_PROPERTIES,
    filters: {
      status: "paid",
      "number~prefix": "INV",
      "issued_date~after": "2024-01-01T00:00:00Z",
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
