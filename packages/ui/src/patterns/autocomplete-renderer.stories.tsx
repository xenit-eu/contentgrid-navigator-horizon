import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { AutocompleteRenderer } from "./autocomplete-renderer";

const meta = {
  title: "Patterns/AutocompleteRenderer",
  component: AutocompleteRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof AutocompleteRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  name: "city",
  label: "City",
  required: false,
  readOnly: false,
  value: "",
  onChange: fn(),
  onQueryChange: fn(),
};

export const Default: Story = {
  args: {
    ...baseArgs,
    suggestions: [],
  },
};

export const Required: Story = {
  args: {
    ...baseArgs,
    required: true,
    suggestions: [],
  },
};

export const Loading: Story = {
  args: {
    ...baseArgs,
    value: "par",
    suggestions: [],
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    ...baseArgs,
    suggestions: [],
    error: "City is required",
  },
};

export const TypingCallsOnQueryChange: Story = {
  args: {
    ...baseArgs,
    suggestions: [],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");
    await fireEvent.change(input, { target: { value: "par" } });
    await expect(args.onQueryChange).toHaveBeenCalledWith("par");
  },
  tags: ["no-visual-test"],
};
