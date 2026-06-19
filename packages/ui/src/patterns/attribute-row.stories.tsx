import type { Meta, StoryObj } from "@storybook/react";
import { AttributeRow } from "./attribute-row";

const meta = {
  title: "Patterns/AttributeRow",
  component: AttributeRow,
  tags: ["autodocs"],
} satisfies Meta<typeof AttributeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValue: Story = {
  args: {
    label: "Invoice number",
    value: "INV-2024-0042",
  },
};

export const Empty: Story = {
  args: {
    label: "Notes",
  },
};

export const ExplicitEmpty: Story = {
  args: {
    label: "Due date",
    value: "2024-12-31",
    empty: true,
  },
};
