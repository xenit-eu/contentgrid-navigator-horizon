import { ArrowRightIcon, TrashIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RecordRowMenu } from "./record-row-menu";

const meta = {
  title: "Patterns/RecordRowMenu",
  component: RecordRowMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      // Room under the button for the open menu.
      <div className="flex h-40 w-72 justify-end">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Actions for INV-2026-04812",
    items: [
      { key: "open", label: "Open", icon: <ArrowRightIcon aria-hidden />, onSelect: fn() },
      {
        key: "delete",
        label: "Delete…",
        icon: <TrashIcon aria-hidden />,
        onSelect: fn(),
        destructive: true,
        separatorBefore: true,
        confirm: {
          title: "Delete item",
          description:
            "Are you sure you want to delete this invoice? This action cannot be undone.",
          actionLabel: "Delete",
        },
      },
    ],
  },
} satisfies Meta<typeof RecordRowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

/** The button is bordered while its menu is open. */
export const Open: Story = {
  args: { defaultOpen: true },
};

/** An item that cannot be deleted: just "Open", with no separator. */
export const OpenOnly: Story = {
  args: { defaultOpen: true, items: meta.args.items.slice(0, 1) },
};
