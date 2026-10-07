import { useState } from "react";
import { HashIcon, ListChecksIcon, MagnifyingGlassIcon, TextAaIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { GroupedSelect, type GroupedSelectGroup } from "./grouped-select";

const groups: GroupedSelectGroup[] = [
  {
    id: "modes",
    options: [
      { value: "all", label: "All" },
      { value: "all-direct", label: "All except relations" },
    ],
  },
  {
    id: "self",
    label: "Invoice",
    options: [
      {
        value: "title",
        label: "Title",
        hint: "Starts with",
        icon: <TextAaIcon size={14} aria-hidden />,
      },
      {
        value: "notes",
        label: "Notes",
        hint: "Full text",
        icon: <MagnifyingGlassIcon size={14} aria-hidden />,
      },
      {
        value: "status",
        label: "Status",
        hint: "One of",
        icon: <ListChecksIcon size={14} aria-hidden />,
      },
      {
        value: "quantity",
        label: "Quantity",
        hint: "Integer",
        icon: <HashIcon size={14} aria-hidden />,
      },
    ],
  },
  {
    id: "customer",
    label: "Customer",
    options: [
      {
        value: "customer.name",
        label: "Name",
        hint: "Starts with",
        icon: <TextAaIcon size={14} aria-hidden />,
      },
    ],
  },
];

const meta = {
  title: "Patterns/GroupedSelect",
  component: GroupedSelect,
  tags: ["autodocs"],
  args: { value: "all", onValueChange: fn(), groups, triggerLabel: "Search in" },
} satisfies Meta<typeof GroupedSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRelations: Story = {
  args: { value: "customer.name" },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <GroupedSelect {...args} value={value} onValueChange={setValue} />;
  },
};

export const Small: Story = {
  args: { value: "quantity", size: "sm" },
};

export const Compact: Story = {
  args: { value: "notes", compact: true },
};
