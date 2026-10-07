import { CalendarIcon, CheckCircleIcon, HashIcon, TextAaIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { type FilterChipItem, FilterChips } from "./filter-chips";

const icon = (Icon: typeof TextAaIcon) => <Icon size={12} aria-hidden />;

const base: FilterChipItem[] = [
  { id: "title", field: "Title", mode: "starts with", modeIcon: icon(TextAaIcon), value: "Alpha" },
  {
    id: "received",
    field: "Received at",
    mode: "between",
    modeIcon: icon(CalendarIcon),
    value: "1 Oct 2026 – 7 Oct 2026",
  },
  { id: "urgent", field: "Urgent", mode: "is", value: "True", valueIcon: icon(CheckCircleIcon) },
];

const many: FilterChipItem[] = [
  ...base,
  { id: "quantity", field: "Quantity", mode: "≥", modeIcon: icon(HashIcon), value: "3" },
  { id: "status", field: "Status", mode: "one of", value: "approved" },
  { id: "notes", field: "Notes", mode: "full text", value: "paid in advance" },
  { id: "customer", field: "Customer · Name", mode: "starts with", value: "Acme" },
  { id: "owner", field: "Owner · Email", mode: "starts with", value: "alice@" },
  { id: "amount", field: "Amount", mode: "between", value: "10 – 99.95" },
  { id: "due", field: "Due date", mode: "after", value: "1 Jan 2027" },
  { id: "created", field: "Created at", mode: "between", value: "30 Sep 2026 – 7 Oct 2026" },
  { id: "modified", field: "Modified at", mode: "before", value: "7 Oct 2026" },
];

const meta = {
  title: "Patterns/FilterChips",
  component: FilterChips,
  tags: ["autodocs"],
  args: { chips: base, onRemove: fn() },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
} satisfies Meta<typeof FilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneLine: Story = {};

export const TwoLines: Story = { args: { chips: many.slice(0, 7) } };

export const Overflow: Story = { args: { chips: many } };

export const SingleLineOverflow: Story = { args: { chips: many, maxLines: 1 } };

export const Empty: Story = { args: { chips: [] } };
