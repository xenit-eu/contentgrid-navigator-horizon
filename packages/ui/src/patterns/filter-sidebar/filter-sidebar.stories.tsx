import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { FilterSidebar } from "./filter-sidebar";

const meta = {
  title: "Patterns/FilterSidebar",
  component: FilterSidebar,
  tags: ["autodocs"],
} satisfies Meta<typeof FilterSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Note: FilterSidebar renders inputs only for "select" (inline options) and "date" / date-suffix
// type properties. Plain string properties without options fall through to null in the component
// — confirmed by filter-sidebar.test.tsx. Text-based searching is typically handled elsewhere
// (e.g. a top-level search bar).

export const Default: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        prompt: "Status",
        type: "string",
        options: { inline: ["draft", "pending", "paid", "cancelled"] },
      },
      { name: "issued_date~greater-than", type: "string" },
    ],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithActiveFilters: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        prompt: "Status",
        type: "string",
        options: { inline: ["draft", "pending", "paid"] },
      },
      { name: "issued_date~greater-than", type: "string" },
    ],
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
        prompt: "Status",
        type: "string",
        options: { inline: ["draft", "pending", "paid", "cancelled"] },
      },
    ],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithDateRangeFilter: Story = {
  args: {
    filterProperties: [
      { name: "issued_date~greater-than", type: "string" },
      { name: "issued_date~less-than", type: "string" },
    ],
    filters: {},
    onFilterChange: fn(),
  },
};

export const WithMixedFilters: Story = {
  args: {
    filterProperties: [
      {
        name: "status",
        prompt: "Status",
        type: "string",
        options: { inline: ["draft", "pending", "paid"] },
      },
      { name: "issued_date~greater-than", type: "string" },
      { name: "issued_date~less-than", type: "string" },
    ],
    filters: { status: "pending" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    filterProperties: [{ name: "created_at", type: "date" }],
    filters: {},
    onFilterChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // date-type property renders an <input type="date">
    const input = canvas.getByDisplayValue("");
    await expect(input).toBeInTheDocument();
    // fireEvent.change matches the pattern used in filter-sidebar.test.tsx for date inputs
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
        prompt: "Status",
        type: "string",
        options: { inline: ["draft", "pending", "paid"] },
      },
    ],
    filters: { status: "paid" },
    onFilterChange: fn(),
    onClearAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const clearBtn = canvas.getByRole("button", { name: /clear all/i });
    await expect(clearBtn).toBeInTheDocument();
    await userEvent.click(clearBtn);
    await expect(args.onClearAll).toHaveBeenCalled();
  },
};
