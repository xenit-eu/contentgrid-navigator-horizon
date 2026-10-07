import type { Meta, StoryObj } from "@storybook/react";
import { Chip } from "./chip";

const meta = {
  title: "Primitives/Chip",
  component: Chip,
  tags: ["autodocs"],
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: {
    label: "Draft",
    tone: "neutral",
  },
};

export const Applied: Story = {
  args: {
    label: "Acme Corp",
    tone: "applied",
  },
};

export const WithField: Story = {
  args: {
    field: "Supplier",
    label: "Acme Corp",
    tone: "neutral",
  },
};

export const Removable: Story = {
  args: {
    label: "Draft",
    tone: "neutral",
    removable: true,
    onRemove: () => {},
  },
};

export const AppliedRemovable: Story = {
  args: {
    field: "Status",
    label: "Approved",
    tone: "applied",
    removable: true,
    onRemove: () => {},
  },
};

export const WithMode: Story = {
  args: {
    field: "Title",
    mode: "starts with",
    label: "Alpha",
    tone: "applied",
    removable: true,
    onRemove: () => {},
  },
};

export const WithValueIcon: Story = {
  args: {
    field: "Urgent",
    mode: "is",
    label: "True",
    valueIcon: <span aria-hidden>✓</span>,
    tone: "applied",
    removable: true,
    onRemove: () => {},
  },
};

export const LongValue: Story = {
  args: {
    field: "Notes",
    mode: "full text",
    label: "Paid in advance by bank transfer after the second reminder was sent",
    tone: "applied",
    removable: true,
    onRemove: () => {},
    className: "max-w-72",
  },
};
