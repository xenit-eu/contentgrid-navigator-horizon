import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { ProfileAttributeOption } from "./attribute-selector";
import { AttributeSelect } from "./attribute-selector";

const ATTRIBUTES: ProfileAttributeOption[] = [
  {
    name: "name",
    title: "Name",
    description: "The display name of the invoice",
    type: "string",
  },
  {
    name: "amount",
    title: "Amount",
    description: "Total invoice amount, in cents",
    type: "long",
  },
  {
    name: "vatRate",
    title: "VAT rate",
    description: "Applicable VAT rate as a percentage",
    type: "double",
  },
  {
    name: "isPaid",
    title: "Is paid",
    description: "Whether the invoice has been settled",
    type: "boolean",
  },
  {
    name: "dueDate",
    title: "Due date",
    description: "Date by which payment is expected",
    type: "date",
  },
  {
    name: "issuedAt",
    title: "Issued at",
    description: "Timestamp of invoice issuance",
    type: "datetime",
  },
  {
    name: "metadata",
    title: "Metadata",
    description: "Freeform nested attributes",
    type: "object",
  },
  {
    name: "attachment",
    title: "Attachment",
    description: "Uploaded PDF of the invoice",
    type: "content",
  },
  {
    name: "createdDate",
    title: "Created date",
    description: "When this record was created",
    type: "datetime",
    isSystem: true,
  },
  {
    name: "createdBy",
    title: "Created by",
    description: "User who created this record",
    type: "string",
    isSystem: true,
  },
  {
    name: "modifiedDate",
    title: "Modified date",
    description: "When this record was last modified",
    type: "datetime",
    isSystem: true,
  },
  {
    name: "modifiedBy",
    title: "Modified by",
    description: "User who last modified this record",
    type: "string",
    isSystem: true,
  },
];

const meta = {
  title: "Patterns/AttributeSelect",
  component: AttributeSelect,
  tags: ["autodocs"],
} satisfies Meta<typeof AttributeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    attributes: ATTRIBUTES,
    onSelect: fn(),
  },
};

export const WithSelection: Story = {
  args: {
    attributes: ATTRIBUTES,
    value: "amount",
    onSelect: fn(),
  },
};

export const WithLabel: Story = {
  args: {
    attributes: ATTRIBUTES,
    label: "Sort by",
    onSelect: fn(),
  },
};

export const Interactive: Story = {
  render: (args) => {
    function InteractiveSelect() {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <AttributeSelect
          {...args}
          value={value}
          onSelect={(attribute) => setValue(attribute.name)}
        />
      );
    }
    return <InteractiveSelect />;
  },
  args: {
    attributes: ATTRIBUTES,
    onSelect: fn(),
  },
};
