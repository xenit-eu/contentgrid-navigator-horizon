import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { textField } from "./test-fixtures";
import { TextRenderer } from "./text-renderer";

const meta = {
  title: "Patterns/FormRenderers/TextRenderer",
  component: TextRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof TextRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    field: textField(),
    value: "",
    onChange: fn(),
  },
};

export const Required: Story = {
  args: {
    field: textField({ required: true }),
    value: "",
    onChange: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    field: textField({ readOnly: true }),
    value: "Acme Corp",
    onChange: fn(),
  },
};

export const WithDescription: Story = {
  args: {
    field: textField({ description: "The legal entity name, as registered." }),
    value: "",
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    field: textField(),
    value: "",
    onChange: fn(),
    error: "Name is required",
  },
};

export const TypingCallsOnChange: Story = {
  args: {
    field: textField(),
    value: "",
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    await fireEvent.change(input, { target: { value: "Acme" } });
    await expect(args.onChange).toHaveBeenCalledWith("Acme");
  },
  tags: ["no-visual-test"],
};
