import { DatabaseIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { IconBadge } from "./icon-badge";

const meta = {
  title: "Primitives/IconBadge",
  component: IconBadge,
} satisfies Meta<typeof IconBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <DatabaseIcon aria-hidden />,
  },
};

export const Sizes: Story = {
  args: {
    icon: <DatabaseIcon aria-hidden />,
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <IconBadge {...args} variant="sm" />
      <IconBadge {...args} variant="default" />
      <IconBadge {...args} variant="lg" />
    </div>
  ),
};

export const WithColor: Story = {
  args: {
    icon: <DatabaseIcon aria-hidden />,
    color: "oklch(0.6 0.2 30)",
  },
};

export const Clickable: Story = {
  args: {
    icon: <DatabaseIcon aria-hidden />,
    color: "oklch(0.6 0.2 30)",
    onClick: fn(),
    "aria-label": "Change color",
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Change color" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
