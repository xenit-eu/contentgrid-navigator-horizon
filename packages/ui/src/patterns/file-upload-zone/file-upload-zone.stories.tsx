import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { FileUploadZone } from "./file-upload-zone";

const meta = {
  title: "Patterns/FileUploadZone",
  component: FileUploadZone,
} satisfies Meta<typeof FileUploadZone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controlled wrapper so stories can show both states. */
const UploadZoneDemo = ({
  initialFile = null,
  accept,
}: {
  initialFile?: File | null;
  accept?: Record<string, string[]>;
}) => {
  const [file, setFile] = React.useState<File | null>(initialFile);
  return <FileUploadZone file={file} onFileChange={setFile} accept={accept} />;
};

export const Default: Story = {
  render: () => <UploadZoneDemo />,
};

export const WithAcceptFilter: Story = {
  render: () => (
    <UploadZoneDemo
      accept={{ "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"] }}
    />
  ),
};

export const WithPdfFile: Story = {
  render: () => {
    const file = new File(["pdf content"], "annual-report.pdf", { type: "application/pdf" });
    return <UploadZoneDemo initialFile={file} />;
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <UploadZoneDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button")).toBeInTheDocument();
  },
};
