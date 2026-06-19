import type { Meta, StoryObj } from "@storybook/react";
import { SearchField } from "./search-field";

const meta = {
  title: "Primitives/SearchField",
  component: SearchField,
  tags: ["autodocs"],
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Search…",
  },
};

export const WithChips: Story = {
  args: {
    chips: [
      { field: "Supplier", label: "Acme Corp" },
      { field: "Status", label: "Pending" },
      { field: "Year", label: "2024" },
    ],
    onRemoveChip: () => {},
  },
};

export const Focused: Story = {
  args: {
    focused: true,
    placeholder: "Search…",
  },
};
