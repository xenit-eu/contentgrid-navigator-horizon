import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FileRenderer } from "./file-renderer";
import { fileField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/FileRenderer",
  component: FileRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof FileRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    ...fileField(),
    value: undefined,
    onChange: fn(),
  },
};

export const FileSelected: Story = {
  args: {
    ...fileField(),
    value: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onChange: fn(),
  },
};

export const WithError: Story = {
  args: {
    ...fileField(),
    value: undefined,
    onChange: fn(),
    error: "File is required",
  },
};
