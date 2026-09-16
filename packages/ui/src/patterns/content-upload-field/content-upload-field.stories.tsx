import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContentUploadField } from "./content-upload-field";

const meta = {
  title: "Patterns/ContentUploadField",
  component: ContentUploadField,
  tags: ["autodocs"],
} satisfies Meta<typeof ContentUploadField>;

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
    // Drop zone must be keyboard accessible and not call onFileChange until a file is selected
    await expect(dropZone).not.toBeDisabled();
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
    const removeBtn = canvas.getByRole("button", { name: /remove file/i });
    // Clicking remove passes null to onFileChange
    await userEvent.click(removeBtn);
    await expect(args.onFileChange).toHaveBeenCalledWith(null);
  },
};

export const Uploading: Story = {
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
    uploadProgress: 45,
    onCancelUpload: fn(),
  },
};

export const UploadError: Story = {
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
    uploadError: true,
    onRetryUpload: fn(),
  },
};

export const CancelInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
    uploadProgress: 45,
    onCancelUpload: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cancelBtn = canvas.getByRole("button", { name: /cancel upload/i });
    await userEvent.click(cancelBtn);
    await expect(args.onCancelUpload).toHaveBeenCalledOnce();
  },
};

export const RetryInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    file: new File(["content"], "invoice.pdf", { type: "application/pdf" }),
    onFileChange: fn(),
    uploadError: true,
    onRetryUpload: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const retryBtn = canvas.getByRole("button", { name: /retry/i });
    await userEvent.click(retryBtn);
    await expect(args.onRetryUpload).toHaveBeenCalledOnce();
  },
};
