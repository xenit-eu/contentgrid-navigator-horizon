import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { EnumRenderer } from "./enum-renderer";
import { REMOTE_OPTIONS, enumField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/EnumRenderer",
  component: EnumRenderer,
  tags: ["autodocs", "axe-no-contrast"],
} satisfies Meta<typeof EnumRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    field: enumField(),
    value: "",
    onChange: fn(),
  },
};

export const WithSelectedValue: Story = {
  args: {
    field: enumField(),
    value: "published",
    onChange: fn(),
  },
};

export const RemoteOptionsNotYetLoaded: Story = {
  args: {
    field: enumField({ optionsSource: REMOTE_OPTIONS }),
    value: "",
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    field: enumField(),
    value: "",
    onChange: fn(),
    error: "Status is required",
  },
};
