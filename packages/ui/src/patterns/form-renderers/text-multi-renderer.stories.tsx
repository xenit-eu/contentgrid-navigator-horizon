import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { textMultiField } from "./test-fixtures";
import { TextMultiRenderer } from "./text-multi-renderer";

const meta = {
  title: "Patterns/FormRenderers/TextMultiRenderer",
  component: TextMultiRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof TextMultiRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { ...textMultiField(), value: [], onChange: fn() },
};

export const WithValues: Story = {
  args: { ...textMultiField(), value: ["invoice", "2026", "urgent"], onChange: fn() },
};

export const AtMaxItems: Story = {
  args: { ...textMultiField({ maxItems: 2 }), value: ["invoice", "2026"], onChange: fn() },
};

export const ReadOnly: Story = {
  args: { ...textMultiField({ readOnly: true }), value: ["invoice", "2026"], onChange: fn() },
};

export const WithError: Story = {
  args: {
    ...textMultiField({ required: true, error: "Keywords is required" }),
    value: [],
    onChange: fn(),
  },
};

/** Fully interactive: the story keeps the value, so chips appear as you add them. */
export const Interactive: Story = {
  args: { ...textMultiField(), value: [], onChange: fn() },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(["invoice"]);
    return (
      <TextMultiRenderer
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Keywords"), "urgent{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith(["invoice", "urgent"]);
    await expect(canvas.getByText("urgent")).toBeInTheDocument();
  },
  tags: ["no-visual-test"],
};
