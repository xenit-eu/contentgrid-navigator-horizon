import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { BrandingHeader } from "./branding-header";

const meta = {
  title: "Patterns/BrandingHeader",
  component: BrandingHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandingHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="ghost" size="sm">
        Sign out
      </Button>
    ),
  },
};

export const WithMultipleActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Settings
        </Button>
        <Button variant="ghost" size="sm">
          Sign out
        </Button>
      </>
    ),
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "ContentGrid logo" })).toBeInTheDocument();
  },
};
