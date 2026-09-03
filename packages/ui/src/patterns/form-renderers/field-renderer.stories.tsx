import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FieldRenderer } from "./field-renderer";
import { enumField, fileField, relationToOneField, textField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/FieldRenderer",
  component: FieldRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof FieldRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextField: Story = {
  args: {
    field: textField(),
    value: "",
    onChange: fn(),
  },
};

export const EnumField: Story = {
  args: {
    field: enumField(),
    value: "",
    onChange: fn(),
  },
  tags: ["axe-no-contrast"],
};

export const UnsupportedFileField: Story = {
  name: "Unsupported field type (file)",
  args: {
    field: fileField(),
    value: undefined,
    onChange: fn(),
  },
};

export const UnsupportedRelationField: Story = {
  name: "Unsupported field type (relation-to-one)",
  args: {
    field: relationToOneField(),
    value: undefined,
    onChange: fn(),
  },
};
