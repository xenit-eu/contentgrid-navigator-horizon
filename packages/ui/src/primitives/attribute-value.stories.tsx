import type { Meta, StoryObj } from "@storybook/react";
import { AttributeValue } from "./attribute-value";

const meta = {
  title: "Primitives/AttributeValue",
  component: AttributeValue,
  tags: ["autodocs"],
} satisfies Meta<typeof AttributeValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Acme Corp",
  },
};

export const Empty: Story = {
  args: {},
};

export const Numeric: Story = {
  args: {
    variant: "numeric",
    children: "1,234.50",
  },
};
