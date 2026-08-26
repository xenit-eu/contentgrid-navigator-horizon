import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { IconColorPickerContent } from "./icon-color-picker";

const meta = {
  title: "Patterns/IconColorPicker",
  component: IconColorPickerContent,
  tags: ["autodocs"],
} satisfies Meta<typeof IconColorPickerContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledIconColorPicker({
  initialIcon,
  initialColor,
}: Readonly<{
  initialIcon?: string;
  initialColor?: string;
}>) {
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);
  return (
    <IconColorPickerContent
      icon={icon}
      onIconChange={setIcon}
      color={color}
      onColorChange={setColor}
    />
  );
}

// This component has no popover chrome of its own — rendered directly, always visible.
export const Default: Story = {
  args: { icon: undefined, onIconChange: fn(), color: undefined, onColorChange: fn() },
  render: () => <ControlledIconColorPicker />,
};

export const Preselected: Story = {
  args: { icon: undefined, onIconChange: fn(), color: undefined, onColorChange: fn() },
  render: () => (
    <ControlledIconColorPicker initialIcon="Database" initialColor="oklch(0.55 0.17 155)" />
  ),
};

export const InPopover: Story = {
  args: { icon: undefined, onIconChange: fn(), color: undefined, onColorChange: fn() },
  tags: ["no-visual-test"],
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open picker</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ControlledIconColorPicker />
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open picker/i }));
    const folderOption = await waitFor(() => within(document.body).getByTitle("Folder"));
    await userEvent.click(folderOption);

    const greenSwatch = within(document.body).getByTitle("Green");
    await userEvent.click(greenSwatch);
    await waitFor(() => expect(greenSwatch).toHaveAttribute("aria-pressed", "true"));
  },
};
