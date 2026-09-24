import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RelationToOneRenderer } from "./relation-to-one-renderer";
import { relationToOneField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/RelationToOneRenderer",
  component: RelationToOneRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof RelationToOneRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    ...relationToOneField(),
    value: "",
    onChange: fn(),
    onLink: fn(),
  },
};

export const Linked: Story = {
  args: {
    ...relationToOneField(),
    value: "https://api.example.com/suppliers/1",
    onChange: fn(),
    onLink: fn(),
    linkedItem: <span className="text-sm font-medium">Acme Corporation</span>,
  },
};

export const ReadOnly: Story = {
  args: {
    ...relationToOneField({ readOnly: true }),
    value: "https://api.example.com/suppliers/1",
    onChange: fn(),
    onLink: fn(),
    linkedItem: <span className="text-sm font-medium">Acme Corporation</span>,
  },
};

export const WithError: Story = {
  args: {
    ...relationToOneField({ required: true, error: "Supplier is required" }),
    value: "",
    onChange: fn(),
    onLink: fn(),
  },
};
