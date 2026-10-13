import { EyeIcon, LinkBreakIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordRowAction } from "./record-row-action";

const meta = {
  title: "Patterns/RecordRowAction",
  component: RecordRowAction,
  tags: ["autodocs"],
  args: { onClick: fn() },
} satisfies Meta<typeof RecordRowAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Details: Story = {
  args: { label: "Details", icon: <EyeIcon className="size-4" aria-hidden /> },
};

export const Remove: Story = {
  args: {
    label: "Remove from selection",
    icon: <LinkBreakIcon className="size-4" aria-hidden />,
  },
};

export const Disabled: Story = {
  args: { ...Details.args, disabled: true },
};
