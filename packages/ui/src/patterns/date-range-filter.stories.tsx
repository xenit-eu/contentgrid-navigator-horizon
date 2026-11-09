import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DateRangeFilter, type DateRangeFilterValue } from "./date-range-filter";

const presets = [
  { id: "last-day", label: "Last day" },
  { id: "last-week", label: "Last week" },
  { id: "last-month", label: "Last month" },
  { id: "last-year", label: "Last year" },
];

// Fixed dates keep the visual baselines stable.
const october = { from: new Date(2026, 9, 5), to: new Date(2026, 9, 9) };

const meta = {
  title: "Patterns/DateRangeFilter",
  component: DateRangeFilter,
  tags: ["autodocs"],
  args: {
    value: {},
    presets,
    onValueChange: fn(),
    onPresetSelect: fn(),
    onApply: fn(),
    onClear: fn(),
  },
  decorators: [(Story) => <div className="w-fit rounded-md border bg-popover">{Story()}</div>],
} satisfies Meta<typeof DateRangeFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: { initial: DateRangeFilterValue; activePresetId?: string }) {
  const [value, setValue] = useState(props.initial);
  return (
    <DateRangeFilter
      value={value}
      onValueChange={setValue}
      presets={presets}
      activePresetId={props.activePresetId}
      onPresetSelect={() => undefined}
      onApply={() => undefined}
      onClear={() => setValue({})}
    />
  );
}

export const Empty: Story = {
  args: { value: { from: undefined, to: undefined } },
  render: () => <Controlled initial={{ from: undefined, to: new Date(2026, 9, 1) }} />,
};

export const WithRange: Story = {
  render: () => <Controlled initial={october} />,
};

export const PresetActive: Story = {
  render: () => <Controlled initial={october} activePresetId="last-week" />,
};
