import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { NumberRenderer } from "./number-renderer";
import { numberField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/NumberRenderer",
  component: NumberRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof NumberRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    field: numberField(),
    value: "",
    onChange: fn(),
  },
};

export const WithValue: Story = {
  args: {
    field: numberField(),
    value: 42,
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    field: numberField(),
    value: "",
    onChange: fn(),
    error: "Quantity is required",
  },
};

export const TypingCallsOnChangeWithACoercedNumber: Story = {
  args: {
    field: numberField(),
    value: "",
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("spinbutton");
    await fireEvent.change(input, { target: { value: "42" } });
    await expect(args.onChange).toHaveBeenCalledWith(42);
  },
  tags: ["no-visual-test"],
};
