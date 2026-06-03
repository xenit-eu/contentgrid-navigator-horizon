import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Badge } from "./badge";

const meta = {
  title: "Primitives/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Badge>Active</Badge>,
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  ),
};

export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="destructive">Failed</Badge>
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="flex gap-2">
      <Badge variant="default">Published</Badge>
      <Badge variant="destructive">Error</Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const published = canvas.getByText("Published");
    const error = canvas.getByText("Error");
    await expect(published).toBeInTheDocument();
    await expect(error).toBeInTheDocument();
  },
};
