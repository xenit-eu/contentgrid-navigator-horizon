import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { BrandingHeader } from "./branding-header";

const meta = {
  title: "Patterns/BrandingHeader",
  component: BrandingHeader,
} satisfies Meta<typeof BrandingHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <BrandingHeader title="ContentGrid" />,
};

export const WithSubtitle: Story = {
  render: () => <BrandingHeader title="ContentGrid" subtitle="Document management" />,
};

export const WithLogo: Story = {
  render: () => (
    <BrandingHeader
      title="ContentGrid"
      subtitle="Document management"
      logoUrl="https://placehold.co/32x32/3b82f6/ffffff?text=CG"
      logoAlt="ContentGrid logo"
    />
  ),
};

export const WithActions: Story = {
  render: () => (
    <BrandingHeader
      title="ContentGrid"
      subtitle="Document management"
      logoUrl="https://placehold.co/32x32/3b82f6/ffffff?text=CG"
      logoAlt="ContentGrid logo"
      actions={
        <>
          <Button variant="ghost" size="sm">
            Help
          </Button>
          <Button size="sm">Sign out</Button>
        </>
      }
    />
  ),
};

export const TitleOnly: Story = {
  render: () => <BrandingHeader title="My Application" />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <BrandingHeader
      title="ContentGrid"
      subtitle="Document management"
      actions={<Button size="sm">Settings</Button>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("ContentGrid")).toBeInTheDocument();
    await expect(canvas.getByText("Document management")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  },
};
