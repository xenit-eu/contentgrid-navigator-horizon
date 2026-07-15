import type { Meta, StoryObj } from "@storybook/react";
import { LoadingPage } from "./loading-page";

const meta = {
  title: "Patterns/LoadingPage",
  component: LoadingPage,
  tags: ["autodocs"],
} satisfies Meta<typeof LoadingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FewRows: Story = {
  args: { rows: 2 },
};
