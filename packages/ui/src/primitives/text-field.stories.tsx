import { MagnifyingGlass } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { TextField } from "./text-field";

const meta = {
  title: "Primitives/TextField",
  component: TextField,
  tags: ["autodocs"],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Invoice number",
    placeholder: "e.g. INV-2024-001",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Search",
    placeholder: "Search…",
    icon: <MagnifyingGlass size={15} />,
  },
};

export const WithError: Story = {
  args: {
    label: "Email address",
    value: "not-an-email",
    error: "Please enter a valid email address",
    state: "error",
  },
};

export const WithHelp: Story = {
  args: {
    label: "Password",
    placeholder: "Enter your password",
    helpText: "Must be at least 8 characters long",
  },
};

export const Disabled: Story = {
  args: {
    label: "Created by",
    value: "system@contentgrid.com",
    state: "disabled",
  },
};

export const Required: Story = {
  args: {
    label: "Supplier name",
    placeholder: "Enter supplier name",
    required: true,
  },
};
