import type { Meta, StoryObj } from "@storybook/react";
import { TruncatedText } from "./truncated-text";

const meta = {
  title: "Patterns/TruncatedText",
  component: TruncatedText,
  tags: ["autodocs"],
} satisfies Meta<typeof TruncatedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Truncated: Story = {
  args: {
    text: "Northwind Logistics — annual maintenance contract 2026",
    maxCharLength: 40,
  },
};

export const WithinLimit: Story = {
  args: {
    text: "Northwind Logistics",
    maxCharLength: 40,
  },
};
