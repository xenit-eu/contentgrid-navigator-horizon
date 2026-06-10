import type { Meta, StoryObj } from "@storybook/react";
import { SignInGate } from "./sign-in-gate";

const meta = {
  title: "Patterns/SignInGate",
  component: SignInGate,
  tags: ["autodocs"],
} satisfies Meta<typeof SignInGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSignIn: () => {},
  },
};
