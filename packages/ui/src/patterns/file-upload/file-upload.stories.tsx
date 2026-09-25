import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { FileUpload } from "./file-upload";

const meta = {
  title: "Patterns/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

const INVOICE = { filename: "invoice.pdf", mimetype: "application/pdf", length: 330_100 };

export const Empty: Story = {
  args: { currentFileMetadata: null, onUpload: fn() },
};

export const FileSelected: Story = {
  args: { currentFileMetadata: INVOICE, onUpload: fn() },
};

export const LargeFileSelected: Story = {
  args: {
    currentFileMetadata: {
      filename: "report.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      length: 5 * 1024 * 1024,
    },
    onUpload: fn(),
  },
};

export const Uploading: Story = {
  args: {
    currentFileMetadata: INVOICE,
    status: { isLoading: true, error: null, progress: 45 },
    onUpload: fn(),
  },
};

export const UploadFailed: Story = {
  args: {
    currentFileMetadata: INVOICE,
    status: { isLoading: false, error: new Error("Upload failed") },
    onUpload: fn(),
    onRetry: fn(),
  },
};

export const InlineEmpty: Story = {
  args: { variant: "inline", currentFileMetadata: null, onUpload: fn() },
};

export const InlineStored: Story = {
  args: { variant: "inline", currentFileMetadata: INVOICE, onUpload: fn() },
};
