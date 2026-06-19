import { FolderIcon as Folder } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { NavItem } from "./nav-item";

const meta = {
  title: "Patterns/NavItem",
  component: NavItem,
  tags: ["autodocs"],
} satisfies Meta<typeof NavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Invoices",
    active: false,
  },
};

export const Active: Story = {
  args: {
    label: "Invoices",
    active: true,
  },
};

export const WithCount: Story = {
  args: {
    label: "Invoices",
    active: false,
    count: 42,
  },
};

export const WithIcon: Story = {
  args: {
    label: "Documents",
    active: false,
    icon: <Folder size={15} />,
  },
};

export const InactiveWithCount: Story = {
  args: {
    label: "Suppliers",
    active: false,
    count: 128,
    icon: <Folder size={15} />,
  },
};
