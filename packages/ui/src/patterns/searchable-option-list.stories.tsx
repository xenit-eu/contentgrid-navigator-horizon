import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SearchableOptionList } from "./searchable-option-list";

const options = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved_by_manager", label: "Approved by manager" },
  { value: "approved_by_finance", label: "Approved by finance" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

const meta = {
  title: "Patterns/SearchableOptionList",
  component: SearchableOptionList,
  tags: ["autodocs"],
  args: { options, value: "approved_by_manager", onValueChange: fn(), label: "Status" },
  decorators: [(Story) => <div className="w-64 rounded-md border bg-popover p-2">{Story()}</div>],
} satisfies Meta<typeof SearchableOptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function Controlled() {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <SearchableOptionList options={options} value={value} onValueChange={setValue} label="Status" />
  );
}

export const Interactive: Story = { render: () => <Controlled /> };

export const NoMatches: Story = { args: { options: [] } };
