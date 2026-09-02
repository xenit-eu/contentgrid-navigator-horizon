import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { ProfileAttributeOption } from "./attribute-selector";
import { AttributeMultiSelect } from "./attribute-selector";

const ATTRIBUTES: ProfileAttributeOption[] = [
  { name: "name", title: "Name", description: "The display name of the invoice", type: "string" },
  { name: "amount", title: "Amount", description: "Total invoice amount, in cents", type: "long" },
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
  title: "Patterns/AttributeMultiSelect",
  component: AttributeMultiSelect,
  tags: ["autodocs"],
} satisfies Meta<typeof AttributeMultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    attributes: ATTRIBUTES,
    values: [],
    onChange: fn(),
  },
};

export const WithSelection: Story = {
  args: {
    attributes: ATTRIBUTES,
    values: ["name", "createdDate"],
    onChange: fn(),
    label: "Columns",
  },
};

export const ManySelected: Story = {
  args: {
    attributes: ATTRIBUTES,
    values: ["name", "amount", "vatRate", "createdDate", "createdBy"],
    onChange: fn(),
  },
};
