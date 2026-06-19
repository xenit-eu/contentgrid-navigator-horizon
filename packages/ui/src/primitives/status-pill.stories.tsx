import { Star } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { StatusPill } from "./status-pill";

const meta = {
  title: "Primitives/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    status: "success",
    label: "Approved",
  },
};

export const Danger: Story = {
  args: {
    status: "danger",
    label: "Rejected",
  },
};

export const Warning: Story = {
  args: {
    status: "warning",
    label: "Pending",
  },
};

export const Neutral: Story = {
  args: {
    status: "neutral",
    label: "Draft",
  },
};

export const CustomIcon: Story = {
  args: {
    status: "success",
    label: "Featured",
    icon: <Star size={14} />,
  },
};
