import type { Meta, StoryObj } from "@storybook/react";
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
