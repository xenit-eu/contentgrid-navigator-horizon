import { LinkBreakIcon, TrashIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordRowConfirmAction } from "./record-row-confirm-action";

const meta = {
  title: "Patterns/RecordRowConfirmAction",
  component: RecordRowConfirmAction,
  tags: ["autodocs"],
  args: { onConfirm: fn() },
} satisfies Meta<typeof RecordRowConfirmAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unlink: Story = {
  args: {
    label: "Unlink",
    icon: <LinkBreakIcon className="size-4" aria-hidden />,
    title: "Unlink product",
    description: "Remove the link to this product? This will not delete the product itself.",
  },
};

export const Delete: Story = {
  args: {
    label: "Delete",
    icon: <TrashIcon className="size-4" aria-hidden />,
    title: "Delete item",
    description: "Are you sure you want to delete this product? This action cannot be undone.",
  },
};

export const Disabled: Story = {
  args: { ...Unlink.args, disabled: true },
};
