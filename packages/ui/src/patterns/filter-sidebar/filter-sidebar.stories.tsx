import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { FilterSidebar } from "./filter-sidebar";
import type { SearchFilterProperty } from "./filter-sidebar";

const meta = {
  title: "Patterns/FilterSidebar",
  component: FilterSidebar,
  tags: ["autodocs"],
} satisfies Meta<typeof FilterSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures reused verbatim across the stories below (status appears in 5
// stories, the issued-date After/Before pair in 4) — see filter-sidebar.test.tsx
// for the same convention.
// ---------------------------------------------------------------------------

const STATUS_PROP: SearchFilterProperty = {
  name: "status",
  label: "Status",
  inputKind: "select",
  searchOperator: "exact-match",
  groupKey: "status",
  options: ["draft", "pending", "paid"],
};

const STATUS_PROP_WITH_CANCELLED: SearchFilterProperty = {
  ...STATUS_PROP,
  options: ["draft", "pending", "paid", "cancelled"],
};

// Suffixes here match a live profile exactly (confirmed against a sandbox backend): every
// operator uses a single plain tilde — "~after"/"~before" for strict date bounds, never a
// spelled-out "~greater-than"/"~less-than" or a dotted "attribute.~op" range-pair form.
const ISSUED_DATE_AFTER_PROP: SearchFilterProperty = {
  name: "issued_date~after",
  label: "Issued Date",
  inputKind: "date",
  searchOperator: "greater-than",
  groupKey: "issued_date",
  directionLabel: "After",
  dateEncoding: "iso",
};

const ISSUED_DATE_BEFORE_PROP: SearchFilterProperty = {
  name: "issued_date~before",
  label: "Issued Date",
  inputKind: "date",
  searchOperator: "less-than",
  groupKey: "issued_date",
  directionLabel: "Before",
  dateEncoding: "iso",
};

export const Default: Story = {
  args: {
    filterProperties: [
      STATUS_PROP_WITH_CANCELLED,
      ISSUED_DATE_AFTER_PROP,
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithActiveFilters: Story = {
  args: {
    filterProperties: [STATUS_PROP, ISSUED_DATE_AFTER_PROP] satisfies SearchFilterProperty[],
    filters: { status: "paid" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
};

export const WithEnumFilter: Story = {
  args: {
    filterProperties: [STATUS_PROP_WITH_CANCELLED] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithDateRangeFilter: Story = {
  args: {
    filterProperties: [
      ISSUED_DATE_AFTER_PROP,
      ISSUED_DATE_BEFORE_PROP,
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithMixedFilters: Story = {
  args: {
    filterProperties: [
      STATUS_PROP,
      ISSUED_DATE_AFTER_PROP,
      ISSUED_DATE_BEFORE_PROP,
    ] satisfies SearchFilterProperty[],
    filters: { status: "pending" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
};

export const WithRangePairFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "created~from",
        label: "Created",
        inputKind: "date",
        searchOperator: "greater-than-or-equal",
        groupKey: "created",
        directionLabel: "From",
        dateEncoding: "plain",
      },
      {
        name: "created~until",
        label: "Created",
        inputKind: "date",
        searchOperator: "less-than-or-equal",
        groupKey: "created",
        directionLabel: "Until",
        dateEncoding: "plain",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithRangePairNumericFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "amount~gte",
        label: "Amount",
        inputKind: "number",
        searchOperator: "greater-than-or-equal",
        groupKey: "amount",
        directionLabel: "From",
      },
      {
        name: "amount~lte",
        label: "Amount",
        inputKind: "number",
        searchOperator: "less-than-or-equal",
        groupKey: "amount",
        directionLabel: "Until",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithBooleanFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "active",
        label: "Active",
        inputKind: "boolean",
        searchOperator: "exact-match",
        groupKey: "active",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithNumberFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "amount",
        label: "Amount",
        inputKind: "number",
        searchOperator: "exact-match",
        groupKey: "amount",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithDatetimeFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "due_at~after",
        label: "Due At",
        inputKind: "datetime",
        searchOperator: "greater-than",
        groupKey: "due_at",
        directionLabel: "After",
        dateEncoding: "iso",
      },
      {
        name: "due_at~before",
        label: "Due At",
        inputKind: "datetime",
        searchOperator: "less-than",
        groupKey: "due_at",
        directionLabel: "Before",
        dateEncoding: "iso",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithTypeaheadFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "number~prefix",
        label: "Invoice number",
        inputKind: "text",
        searchOperator: "prefix-match",
        groupKey: "number",
      },
    ] satisfies SearchFilterProperty[],
    filters: { "number~prefix": "INV" },
    onFilterChange: fn(),
    onTypeaheadSearch: fn(),
    activeTypeaheadField: "number~prefix",
    typeaheadSuggestions: ["INV-001", "INV-002", "INV-003"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: /invoice number/i }));
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    filterProperties: [
      {
        name: "created_at",
        label: "Created At",
        inputKind: "date",
        searchOperator: "exact-match",
        groupKey: "created_at",
        dateEncoding: "iso",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "2024-01-15" } });
    await expect(args.onFilterChange).toHaveBeenCalledWith("created_at", "2024-01-15T00:00:00Z");
  },
};

export const ClearAllInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    filterProperties: [STATUS_PROP] satisfies SearchFilterProperty[],
    filters: { status: "paid" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const clearBtn = canvas.getByRole("button", { name: /clear all/i });
    await userEvent.click(clearBtn);
    await expect(args.onClearAll).toHaveBeenCalled();
  },
};
