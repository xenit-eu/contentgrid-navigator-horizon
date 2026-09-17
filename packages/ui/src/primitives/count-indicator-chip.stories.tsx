import type { Meta, StoryObj } from "@storybook/react";
import { CountIndicatorChip } from "./count-indicator-chip";

const meta = {
  title: "Primitives/CountIndicatorChip",
  component: CountIndicatorChip,
  tags: ["autodocs"],
} satisfies Meta<typeof CountIndicatorChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Exact: Story = {
  args: {
    count: 42,
  },
};

export const Estimated: Story = {
  args: {
    count: 1200,
    isEstimated: true,
  },
};

export const Zero: Story = {
  args: {
    count: 0,
  },
};

export const Unknown: Story = {
  args: {
    count: null,
  },
};
