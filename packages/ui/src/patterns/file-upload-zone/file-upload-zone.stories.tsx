import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileUploadZone } from "./file-upload-zone";

const meta = {
  title: "Patterns/FileUploadZone",
  component: FileUploadZone,
  tags: ["autodocs"],
} satisfies Meta<typeof FileUploadZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    file: null,
    onFileChange: fn(),
  },
};

export const WithPdfAccept: Story = {
  args: {
    file: null,
    onFileChange: fn(),
    accept: { "application/pdf": [".pdf"] },
  },
};

export const FileSelected: Story = {
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
  },
};

export const LargeFileSelected: Story = {
  args: {
    file: new File([new ArrayBuffer(5 * 1024 * 1024)], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    onFileChange: fn(),
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    file: null,
    onFileChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dropZone = canvas.getByRole("button");
    await expect(dropZone).toBeInTheDocument();
    await expect(dropZone).toBeVisible();
    // Verify the drop zone button is keyboard accessible
    await expect(dropZone).not.toBeDisabled();
    // onFileChange not yet called — no file selected
    await expect(args.onFileChange).not.toHaveBeenCalled();
  },
};

export const RemoveFileInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const removeBtn = canvas.getByRole("button", { name: /remove/i });
    await expect(removeBtn).toBeInTheDocument();
    await expect(removeBtn).toBeVisible();
    // Clicking remove passes null to onFileChange
    await userEvent.click(removeBtn);
    await expect(args.onFileChange).toHaveBeenCalledWith(null);
  },
};
