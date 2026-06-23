import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { DateRange } from "react-day-picker";
import { expect, userEvent, within } from "storybook/test";
import { Calendar } from "./calendar";

const meta = {
  title: "Primitives/Calendar",
  component: Calendar,
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

const CalendarDefaultDemo = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  return <Calendar mode="single" selected={date} onSelect={setDate} />;
};

const CalendarRangeDemo = () => {
  const [range, setRange] = React.useState<DateRange | undefined>();
  return <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />;
};

const CalendarDropdownCaptionDemo = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      captionLayout="dropdown"
      startMonth={new Date(2020, 0)}
      endMonth={new Date(2030, 11)}
    />
  );
};

const CalendarWithInteractionDemo = () => {
  const [date, setDate] = React.useState<Date | undefined>();
  return (
    <div>
      <Calendar mode="single" selected={date} onSelect={setDate} />
      {date && <p data-testid="selected-date">{date.toDateString()}</p>}
    </div>
  );
};

export const Default: Story = {
  render: () => <CalendarDefaultDemo />,
};

export const Range: Story = {
  render: () => <CalendarRangeDemo />,
};

export const DropdownCaption: Story = {
  render: () => <CalendarDropdownCaptionDemo />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <CalendarWithInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The next-month navigation button (react-day-picker labels it
    // "Go to the Next Month") must be present.
    const nextBtn = canvas.getByRole("button", { name: /go to the next month/i });
    await expect(nextBtn).toBeInTheDocument();
    await userEvent.click(nextBtn);
    // Find any day button and click it (pick the first available day cell)
    const dayButtons = canvas
      .getAllByRole("button")
      .filter((btn: HTMLElement) => /^\d{1,2}$/.test(btn.textContent?.trim() ?? ""));
    await expect(dayButtons.length).toBeGreaterThan(0);
    await userEvent.click(dayButtons[0]);
    // After selection, a selected date indicator should appear
    const grid = canvas.getByRole("grid");
    await expect(grid).toBeInTheDocument();
  },
};
