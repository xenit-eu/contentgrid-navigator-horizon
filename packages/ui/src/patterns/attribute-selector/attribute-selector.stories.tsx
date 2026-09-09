import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AttributeSelect } from "./attribute-selector";
import { ATTRIBUTES } from "./attribute-selector.fixtures";

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

export const NoOptions: Story = {
  args: {
    attributes: [],
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
