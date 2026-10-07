import {
  CalendarIcon,
  CheckCircleIcon,
  HashIcon,
  ToggleLeftIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FilterButton } from "./filter-button";

const meta = {
  title: "Primitives/FilterButton",
  component: FilterButton,
  tags: ["autodocs"],
  args: { onClick: fn(), onClear: fn() },
} satisfies Meta<typeof FilterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { label: "Due date", icon: <CalendarIcon size={14} aria-hidden /> },
};

export const Active: Story = {
  args: { label: "Due date", tone: "active", icon: <CalendarIcon size={14} aria-hidden /> },
};

export const Positive: Story = {
  args: { label: "Urgent", tone: "positive", icon: <CheckCircleIcon size={14} aria-hidden /> },
};

export const Negative: Story = {
  args: { label: "Urgent", tone: "negative", icon: <XCircleIcon size={14} aria-hidden /> },
};

export const ActiveWithClear: Story = {
  args: { label: "Quantity", tone: "active", icon: <HashIcon size={14} aria-hidden /> },
};

export const LongLabel: Story = {
  args: {
    label: "Expected delivery date of the replacement part",
    tone: "active",
    icon: <CalendarIcon size={14} aria-hidden />,
  },
};

export const Row: Story = {
  args: { label: "Due date" },
  render: () => (
    <div className="flex gap-2">
      <FilterButton label="Due date" icon={<CalendarIcon size={14} aria-hidden />} />
      <FilterButton
        label="Quantity"
        tone="active"
        onClear={() => undefined}
        icon={<HashIcon size={14} aria-hidden />}
      />
      <FilterButton
        label="Urgent"
        tone="positive"
        icon={<CheckCircleIcon size={14} aria-hidden />}
      />
      <FilterButton label="Archived" icon={<ToggleLeftIcon size={14} aria-hidden />} />
    </div>
  ),
};
