import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
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

export const RemoveFileInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    ...fileField(),
    value: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const removeBtn = canvas.getByRole("button", { name: /remove file/i });
    await fireEvent.click(removeBtn);
    await expect(args.onChange).toHaveBeenCalledWith(undefined);
  },
};
