import type { Meta, StoryObj } from "@storybook/react";
import { FileIcon } from "./file-icon";

const meta = {
  title: "Primitives/FileIcon",
  component: FileIcon,
  tags: ["autodocs"],
} satisfies Meta<typeof FileIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PDF: Story = {
  args: {
    type: "pdf",
  },
};

export const Img: Story = {
  args: {
    type: "img",
  },
};

export const Doc: Story = {
  args: {
    type: "doc",
  },
};

export const LargeSize: Story = {
  args: {
    type: "pdf",
    size: 48,
  },
};

export const SmallSize: Story = {
  args: {
    type: "img",
    size: 20,
  },
};
