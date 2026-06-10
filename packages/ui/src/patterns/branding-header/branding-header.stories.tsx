import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { BrandingHeader } from "./branding-header";

// Static asset served from apps/storybook/public/ — same convention as avatar.stories.tsx.
const LOGO_URI = "/avatar-placeholder.png";

const meta = {
  title: "Patterns/BrandingHeader",
  component: BrandingHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandingHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "ContentGrid",
  },
};

export const WithSubtitle: Story = {
  args: {
    title: "ContentGrid",
    subtitle: "Document Management",
  },
};

export const WithLogo: Story = {
  args: {
    title: "ContentGrid",
    subtitle: "Document Management",
    logoUrl: LOGO_URI,
    logoAlt: "ContentGrid logo",
  },
};

export const WithActions: Story = {
  args: {
    title: "ContentGrid",
    subtitle: "Document Management",
    actions: (
      <Button variant="ghost" size="sm">
        Sign out
      </Button>
    ),
  },
};

export const WithLogoAndActions: Story = {
  args: {
    title: "ContentGrid",
    subtitle: "Document Management",
    logoUrl: LOGO_URI,
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

export const Ocean: Story = {
  args: {
    variant: "ocean",
    title: "contentgrid",
    subtitle: "BY AMEXIO",
  },
};

export const OceanWithActions: Story = {
  args: {
    variant: "ocean",
    title: "contentgrid",
    subtitle: "BY AMEXIO",
    actions: (
      <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
        Sign out
      </Button>
    ),
  },
};

export const OceanWithLogo: Story = {
  args: {
    variant: "ocean",
    title: "contentgrid",
    subtitle: "BY AMEXIO",
    logoUrl: LOGO_URI,
    logoAlt: "ContentGrid logo",
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    title: "ContentGrid",
    subtitle: "Document Management",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("ContentGrid")).toBeInTheDocument();
    await expect(canvas.getByText("Document Management")).toBeInTheDocument();
  },
};
