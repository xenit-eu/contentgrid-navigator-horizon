import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Progress } from "./progress";

const meta = {
  title: "Primitives/Progress",
  component: Progress,
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Progress value={40} aria-label="Upload progress" className="w-64" />,
};

export const Empty: Story = {
  render: () => <Progress value={0} aria-label="Upload progress" className="w-64" />,
};

export const Complete: Story = {
  render: () => <Progress value={100} aria-label="Upload progress" className="w-64" />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <Progress value={65} max={100} aria-label="Upload progress" className="w-64" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const progress = canvas.getByRole("progressbar", { name: /upload progress/i });
    await expect(progress).toHaveValue(65);
  },
};
