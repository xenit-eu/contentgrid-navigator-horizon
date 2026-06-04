import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Separator } from "./separator";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-48">
      <p className="text-sm font-medium">Account</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Notifications</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Security</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4 text-sm">
      <span>Home</span>
      <Separator orientation="vertical" />
      <span>Settings</span>
      <Separator orientation="vertical" />
      <span>Help</span>
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="w-48">
      <p className="text-sm font-medium">Section A</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Section B</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Separator is decorative by default (Radix renders role="none"), so it is
    // queried via its data-slot attribute rather than the "separator" role.
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    await expect(separator).toBeInTheDocument();
    await expect(separator).toHaveAttribute("data-orientation", "horizontal");
    await expect(canvas.getByText("Section A")).toBeInTheDocument();
    await expect(canvas.getByText("Section B")).toBeInTheDocument();
  },
};
