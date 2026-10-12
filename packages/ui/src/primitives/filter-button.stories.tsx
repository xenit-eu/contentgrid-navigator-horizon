import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

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

export const WithoutChevron: Story = {
  args: {
    label: "Urgent",
    showChevron: false,
    icon: <ToggleLeftIcon size={14} aria-hidden />,
  },
};

export const LongLabel: Story = {
  args: {
    label: "Expected delivery date of the replacement part",
    tone: "active",
    icon: <CalendarIcon size={14} aria-hidden />,
  },
};

function BooleanFilterDemo() {
  const [value, setValue] = useState<boolean | undefined>(undefined);
  const cycle = () => setValue((v) => (v === undefined ? true : v ? false : undefined));
  return (
    <FilterButton
      label={value === undefined ? "Urgent" : `Urgent: ${value ? "True" : "False"}`}
      tone={value === undefined ? "idle" : value ? "positive" : "negative"}
      icon={
        value === undefined ? (
          <ToggleLeftIcon size={14} aria-hidden />
        ) : value ? (
          <CheckCircleIcon size={14} aria-hidden />
        ) : (
          <XCircleIcon size={14} aria-hidden />
        )
      }
      showChevron={false}
      onClick={cycle}
      onClear={() => setValue(undefined)}
    />
  );
}

/** Click to cycle unset → true → false → unset; the × clears it. */
export const BooleanCycle: Story = {
  args: { label: "Urgent" },
  render: () => <BooleanFilterDemo />,
};

export const Row: Story = {
  args: { label: "Due date" },
  render: () => (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <FilterButton label="Due date" icon={<CalendarIcon size={14} aria-hidden />} />
        </PopoverTrigger>
        <PopoverContent className="w-48 text-sm">Date range picker</PopoverContent>
      </Popover>
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
      <BooleanFilterDemo />
    </div>
  ),
};
