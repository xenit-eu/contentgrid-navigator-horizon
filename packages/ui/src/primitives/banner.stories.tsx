import { BellIcon as Bell } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Banner } from "./banner";

const meta = {
  title: "Primitives/Banner",
  component: Banner,
  tags: ["autodocs"],
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    tone: "info",
    text: "This document is read-only. Contact your administrator to make changes.",
  },
};

export const Edit: Story = {
  args: {
    tone: "edit",
    text: "You are editing a draft. Changes are saved automatically.",
  },
};

export const WarningTone: Story = {
  name: "Warning",
  args: {
    tone: "warning",
    text: "This action cannot be undone. Please review your changes carefully.",
  },
};

export const CustomIcon: Story = {
  args: {
    tone: "info",
    text: "You have 3 pending notifications.",
    icon: <Bell size={16} />,
  },
};
