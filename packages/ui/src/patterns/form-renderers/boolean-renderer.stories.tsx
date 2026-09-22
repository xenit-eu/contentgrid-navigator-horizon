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

export const False: Story = {
  args: {
    ...booleanField(),
    value: false,
    onChange: fn(),
  },
};

export const True: Story = {
  args: {
    ...booleanField(),
    value: true,
    onChange: fn(),
  },
};

export const Unset: Story = {
  args: {
    ...booleanField(),
    value: undefined,
    onChange: fn(),
  },
};

export const ClearResetsToUnset: Story = {
  args: {
    ...booleanField(),
    value: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole("button", { name: "Clear" }));
    await expect(args.onChange).toHaveBeenCalledWith(undefined);
  },
  tags: ["no-visual-test"],
};

export const ReadOnly: Story = {
  args: {
    ...booleanField({ readOnly: true }),
    value: true,
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...booleanField(),
    value: false,
    onChange: fn(),
    error: "Must be accepted",
  },
};

export const ClickingTrueTogglesOnChange: Story = {
  args: {
    ...booleanField(),
    value: false,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole("button", { name: "True" }));
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
  tags: ["no-visual-test"],
};
