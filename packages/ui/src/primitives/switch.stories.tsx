import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
  title: "Primitives/Switch",
  component: Switch,
  tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Switch aria-label="Default switch" />,
};

export const Checked: Story = {
  render: () => <Switch aria-label="Checked switch" defaultChecked />,
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4">
      <Switch aria-label="Disabled unchecked switch" disabled />
      <Switch aria-label="Disabled checked switch" disabled defaultChecked />
    </div>
  ),
};

const WithLabelDemo = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch id="airplane-mode" checked={checked} onCheckedChange={setChecked} />
      <Label htmlFor="airplane-mode">Airplane mode</Label>
    </div>
  );
};

export const WithLabel: Story = {
  render: () => <WithLabelDemo />,
};
