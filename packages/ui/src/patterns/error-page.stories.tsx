import type { Meta, StoryObj } from "@storybook/react";
import { ErrorPage } from "./error-page";

const meta = {
  title: "Patterns/ErrorPage",
  component: ErrorPage,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "Failed to load invoices: Network error",
  },
};

export const WithRetry: Story = {
  args: {
    message: "Failed to load invoices: Network error",
    onRetry: () => {},
    retryLabel: "Back to first page",
  },
};
