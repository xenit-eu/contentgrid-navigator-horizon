import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { typeaheadField } from "./test-fixtures";
import { TypeaheadRenderer } from "./typeahead-renderer";

const meta = {
  title: "Patterns/FormRenderers/TypeaheadRenderer",
  component: TypeaheadRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof TypeaheadRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    ...typeaheadField(),
    value: "",
    onChange: fn(),
  },
};

export const WithSuggestions: Story = {
  args: {
    ...typeaheadField({ suggestions: ["Acme Corp", "Acme Industries", "Acme Logistics"] }),
    value: "Acme",
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
    await expect(canvas.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: {
    ...typeaheadField({ isLoading: true }),
    value: "Ac",
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
    await expect(canvas.getByText("Loading…")).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    ...typeaheadField({ disabled: true }),
    value: "",
    onChange: fn(),
  },
};
