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

export const Default: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        label: "Status",
        inputKind: "select",
        searchOperator: "exact-match",
        groupKey: "status",
        options: ["draft", "pending", "paid", "cancelled"],
      },
      {
        name: "issued_date~greater-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "greater-than",
        groupKey: "issued_date",
        directionLabel: "After",
        dateEncoding: "iso",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithActiveFilters: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        label: "Status",
        inputKind: "select",
        searchOperator: "exact-match",
        groupKey: "status",
        options: ["draft", "pending", "paid"],
      },
      {
        name: "issued_date~greater-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "greater-than",
        groupKey: "issued_date",
        directionLabel: "After",
        dateEncoding: "iso",
      },
    ] satisfies SearchFilterProperty[],
    filters: { status: "paid" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
};

export const WithEnumFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        label: "Status",
        inputKind: "select",
        searchOperator: "exact-match",
        groupKey: "status",
        options: ["draft", "pending", "paid", "cancelled"],
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithDateRangeFilter: Story = {
  args: {
    filterProperties: [
      {
        name: "issued_date~greater-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "greater-than",
        groupKey: "issued_date",
        directionLabel: "After",
        dateEncoding: "iso",
      },
      {
        name: "issued_date~less-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "less-than",
        groupKey: "issued_date",
        directionLabel: "Before",
        dateEncoding: "iso",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithMixedFilters: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        label: "Status",
        inputKind: "select",
        searchOperator: "exact-match",
        groupKey: "status",
        options: ["draft", "pending", "paid"],
      },
      {
        name: "issued_date~greater-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "greater-than",
        groupKey: "issued_date",
        directionLabel: "After",
        dateEncoding: "iso",
      },
      {
        name: "issued_date~less-than",
        label: "Issued Date",
        inputKind: "date",
        searchOperator: "less-than",
        groupKey: "issued_date",
        directionLabel: "Before",
        dateEncoding: "iso",
      },
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
        name: "created.~from",
        label: "Created",
        inputKind: "date",
        searchOperator: "greater-than-or-equal",
        groupKey: "created",
        directionLabel: "From",
        dateEncoding: "plain",
      },
      {
        name: "created.~until",
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
        name: "amount.~gte",
        label: "Amount",
        inputKind: "text",
        searchOperator: "greater-than-or-equal",
        groupKey: "amount",
        directionLabel: "From",
      },
      {
        name: "amount.~lte",
        label: "Amount",
        inputKind: "text",
        searchOperator: "less-than-or-equal",
        groupKey: "amount",
        directionLabel: "Until",
      },
    ] satisfies SearchFilterProperty[],
    filters: {},
    onFilterChange: fn(),
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
    filterProperties: [
      {
        name: "status",
        label: "Status",
        inputKind: "select",
        searchOperator: "exact-match",
        groupKey: "status",
        options: ["draft", "pending", "paid"],
      },
    ] satisfies SearchFilterProperty[],
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
