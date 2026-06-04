import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Textarea placeholder="Write a message…" className="w-64" />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Describe your issue…" rows={4} />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="disabled-ta">Notes</Label>
      <Textarea id="disabled-ta" disabled value="This field is read-only." readOnly />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="invalid-ta">Bio</Label>
      <Textarea id="invalid-ta" aria-invalid="true" defaultValue="A" />
      <p className="text-sm text-destructive">Bio must be at least 20 characters.</p>
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="ia-textarea">Notes</Label>
      <Textarea id="ia-textarea" placeholder="Enter notes…" rows={3} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole("textbox");
    await userEvent.click(textarea);
    await userEvent.type(textarea, "Hello world");
    await expect(textarea).toHaveValue("Hello world");
  },
};
