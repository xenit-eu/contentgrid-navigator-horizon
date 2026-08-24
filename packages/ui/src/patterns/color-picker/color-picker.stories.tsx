import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ColorPicker } from "./color-picker";

const meta = {
  title: "Patterns/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledColorPicker({ initial }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ColorPicker value={value} onChange={setValue} />;
}

export const Unset: Story = {
  render: () => <ControlledColorPicker />,
};

export const Preselected: Story = {
  render: () => <ControlledColorPicker initial="oklch(0.55 0.17 155)" />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <ControlledColorPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /choose color/i }));
    const greenSwatch = await waitFor(() => within(document.body).getByTitle("Green"));
    await userEvent.click(greenSwatch);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Color: oklch(0.55 0.17 155)" }),
      ).toBeInTheDocument(),
    );
  },
};
