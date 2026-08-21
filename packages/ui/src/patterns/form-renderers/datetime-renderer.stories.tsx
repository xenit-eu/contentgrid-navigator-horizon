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
    field: datetimeField(),
    value: "",
    onChange: fn(),
  },
};

export const WithTime: Story = {
  args: {
    field: datetimeField({ includesTime: true, name: "scheduledAt", label: "Scheduled at" }),
    value: "",
    onChange: fn(),
  },
};

export const WithValue: Story = {
  args: {
    field: datetimeField(),
    value: new Date("2024-03-15T00:00:00.000Z"),
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    field: datetimeField(),
    value: "",
    onChange: fn(),
    error: "Due date is required",
  },
};
