import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Checkbox aria-label="Default checkbox" />,
};

export const Checked: Story = {
  render: () => <Checkbox aria-label="Checked checkbox" defaultChecked />,
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4">
      <Checkbox aria-label="Disabled unchecked checkbox" disabled />
      <Checkbox aria-label="Disabled checked checkbox" disabled defaultChecked />
    </div>
  ),
};

const WithLabelDemo = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  );
};

export const WithLabel: Story = {
  render: () => <WithLabelDemo />,
};
