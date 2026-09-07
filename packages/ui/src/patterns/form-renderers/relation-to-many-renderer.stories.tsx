import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { EntityPickerOption } from "../entity-picker";
import { RelationToManyRenderer } from "./relation-to-many-renderer";
import { relationToManyField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/RelationToManyRenderer",
  component: RelationToManyRenderer,
  tags: ["autodocs", "axe-no-contrast"],
} satisfies Meta<typeof RelationToManyRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS: EntityPickerOption[] = [
  { id: "1", href: "/products/1", data: { name: "Widget" } },
  { id: "2", href: "/products/2", data: { name: "Gadget" } },
];

export const Empty: Story = {
  args: {
    ...relationToManyField(),
    value: [],
    onChange: fn(),
    options: OPTIONS,
  },
};

export const WithLinkedItems: Story = {
  args: {
    ...Empty.args,
    value: ["/products/1", "/products/2"],
    selectedItemsData: { "/products/1": { name: "Widget" }, "/products/2": { name: "Gadget" } },
  },
};

export const ReadOnly: Story = {
  args: {
    ...WithLinkedItems.args,
    readOnly: true,
  },
};

export const WithError: Story = {
  args: {
    ...Empty.args,
    error: "Something went wrong",
  },
};
