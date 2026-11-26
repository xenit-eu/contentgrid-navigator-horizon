import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DateTimeRenderer } from "./datetime-renderer";
import { datetimeField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/DateTimeRenderer",
  component: DateTimeRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof DateTimeRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DateOnly: Story = {
  args: {
    ...datetimeField(),
    value: "",
    onChange: fn(),
  },
};

export const WithTime: Story = {
  args: {
    ...datetimeField({ includesTime: true, name: "scheduledAt", label: "Scheduled at" }),
    value: "",
    onChange: fn(),
  },
};

export const WithValue: Story = {
  args: {
    ...datetimeField(),
    value: new Date(2026, 4, 14),
    onChange: fn(),
  },
};

export const WithDateTimeValue: Story = {
  args: {
    ...datetimeField({ includesTime: true, name: "scheduledAt", label: "Scheduled at" }),
    value: new Date(2026, 4, 15, 9, 12),
    onChange: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    ...datetimeField({ readOnly: true }),
    value: new Date(2026, 4, 14),
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...datetimeField(),
    value: "",
    onChange: fn(),
    error: "Due date is required",
  },
};
