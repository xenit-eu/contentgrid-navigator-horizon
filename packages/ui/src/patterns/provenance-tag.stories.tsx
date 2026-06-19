import type { Meta, StoryObj } from "@storybook/react";
import { ProvenanceTag } from "./provenance-tag";

const meta = {
  title: "Patterns/ProvenanceTag",
  component: ProvenanceTag,
  tags: ["autodocs"],
} satisfies Meta<typeof ProvenanceTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Extracted: Story = {
  args: {
    kind: "extracted",
  },
};

export const Modified: Story = {
  args: {
    kind: "modified",
  },
};

export const CustomLabel: Story = {
  args: {
    kind: "extracted",
    label: "AI Generated",
  },
};
