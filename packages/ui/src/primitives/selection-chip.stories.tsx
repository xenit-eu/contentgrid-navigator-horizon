import type { Meta, StoryObj } from "@storybook/react";
import { SelectionChip } from "./selection-chip";

const meta = {
  title: "Primitives/SelectionChip",
  component: SelectionChip,
  tags: ["autodocs"],
} satisfies Meta<typeof SelectionChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "All",
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    label: "Invoices",
    selected: true,
  },
};

export const Group: Story = {
  args: {
    label: "All",
  },
  render: () => (
    <div className="flex gap-2">
      <SelectionChip label="All" selected={false} />
      <SelectionChip label="Invoices" selected={true} />
      <SelectionChip label="Suppliers" selected={false} />
      <SelectionChip label="Contracts" selected={false} />
    </div>
  ),
};
