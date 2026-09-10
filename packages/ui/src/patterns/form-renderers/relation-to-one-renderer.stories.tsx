import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { EntityItemPickerOption } from "../entity-item-picker";
import { RelationToOneRenderer } from "./relation-to-one-renderer";
import { relationToOneField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/RelationToOneRenderer",
  component: RelationToOneRenderer,
  tags: ["autodocs", "axe-no-contrast"],
} satisfies Meta<typeof RelationToOneRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS: EntityItemPickerOption[] = [
  { id: "1", href: "/suppliers/1", data: { name: "Acme Corp" } },
  { id: "2", href: "/suppliers/2", data: { name: "Globex Inc" } },
];

export const Empty: Story = {
  args: {
    ...relationToOneField(),
    value: undefined,
    onChange: fn(),
    options: OPTIONS,
  },
};

export const Linked: Story = {
  args: {
    ...Empty.args,
    value: "/suppliers/1",
    selectedItemsData: { "/suppliers/1": { name: "Acme Corp" } },
  },
};

export const ReadOnly: Story = {
  args: {
    ...Linked.args,
    readOnly: true,
  },
};

export const WithError: Story = {
  args: {
    ...Empty.args,
    required: true,
    error: "Supplier is required",
  },
};
