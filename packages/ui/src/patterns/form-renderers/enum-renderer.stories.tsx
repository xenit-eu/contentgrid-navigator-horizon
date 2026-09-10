import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { EnumRenderer } from "./enum-renderer";
import { enumField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/EnumRenderer",
  component: EnumRenderer,
  tags: ["autodocs", "axe-no-contrast"],
} satisfies Meta<typeof EnumRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...enumField(),
    value: "",
    onChange: fn(),
  },
};

export const WithSelectedValue: Story = {
  args: {
    ...enumField(),
    value: "published",
    onChange: fn(),
  },
};

export const RemoteOptionsNotYetLoaded: Story = {
  args: {
    ...enumField({ options: [], isRemote: true }),
    value: "",
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...enumField(),
    value: "",
    onChange: fn(),
    error: "Status is required",
  },
};
