import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { BooleanRenderer } from "./boolean-renderer";
import { booleanField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/BooleanRenderer",
  component: BooleanRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof BooleanRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: {
    field: booleanField(),
    value: false,
    onChange: fn(),
  },
};

export const Checked: Story = {
  args: {
    field: booleanField(),
    value: true,
    onChange: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    field: booleanField({ readOnly: true }),
    value: true,
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    field: booleanField(),
    value: false,
    onChange: fn(),
    error: "Must be accepted",
  },
};

export const ClickingTogglesOnChange: Story = {
  args: {
    field: booleanField(),
    value: false,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox");
    await fireEvent.click(checkbox);
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
  tags: ["no-visual-test"],
};
