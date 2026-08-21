import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { EntityPickerOption } from "../entity-picker";
import { RelationToOneRenderer } from "./relation-to-one-renderer";
import { relationToOneField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/RelationToOneRenderer",
  component: RelationToOneRenderer,
  tags: ["autodocs", "axe-no-contrast"],
} satisfies Meta<typeof RelationToOneRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS: EntityPickerOption[] = [
  { id: "1", href: "/suppliers/1", data: { name: "Acme Corp" } },
  { id: "2", href: "/suppliers/2", data: { name: "Globex Inc" } },
];

export const Empty: Story = {
  args: {
    field: relationToOneField(),
    value: undefined,
    onChange: fn(),
    options: OPTIONS,
    isLoading: false,
    searchQuery: "",
    onSearch: fn(),
    hasPreviousPage: false,
    hasNextPage: false,
    onPreviousPage: fn(),
    onNextPage: fn(),
    selectedItemsData: {},
    onItemResolved: fn(),
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
    field: relationToOneField({ readOnly: true }),
  },
};

export const WithError: Story = {
  args: {
    ...Empty.args,
    field: relationToOneField({ required: true }),
    error: "Supplier is required",
  },
};
