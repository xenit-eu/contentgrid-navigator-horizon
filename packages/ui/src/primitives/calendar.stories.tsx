import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "./calendar"

const meta = {
  title: "Primitives/Calendar",
  component: Calendar,
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(new Date())
    return <Calendar mode="single" selected={date} onSelect={setDate} />
  },
}

export const Range: Story = {
  render: () => {
    const [range, setRange] = React.useState<DateRange | undefined>()
    return (
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={2}
      />
    )
  },
}

export const DropdownCaption: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(new Date())
    return (
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        captionLayout="dropdown"
        fromYear={2020}
        toYear={2030}
      />
    )
  },
}
