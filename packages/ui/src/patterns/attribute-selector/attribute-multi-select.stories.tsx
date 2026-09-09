import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AttributeMultiSelect } from "./attribute-selector";
import { ATTRIBUTES } from "./attribute-selector.fixtures";

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

export const StaleSelection: Story = {
  args: {
    attributes: ATTRIBUTES,
    values: ["archivedAttribute"],
    onChange: fn(),
  },
};

export const NoOptions: Story = {
  args: {
    attributes: [],
    values: [],
    onChange: fn(),
  },
};
