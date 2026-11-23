import type { Meta, StoryObj } from "@storybook/react";
import { BrandLockup } from "./brand-lockup";

const meta = {
  title: "Patterns/BrandingHeader/BrandLockup",
  component: BrandLockup,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandLockup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** White logo and text, as in the page header. */
export const OnDark: Story = {
  render: () => (
    <div className="flex items-center gap-2.5 bg-[var(--ocean)] p-5">
      <BrandLockup tone="on-dark" />
    </div>
  ),
};

/**
 * Dark logo with sky and ocean wordmark, as in the phone drawer. Tagged `axe-no-contrast` because
 * "content" is set in sky on white (3.08:1); WCAG 1.4.3 exempts logotypes. The "BY AMEXIO" line
 * (ocean on white) passed the contrast check on its own when this story was untagged.
 */
export const OnLight: Story = {
  tags: ["axe-no-contrast"],
  render: () => (
    <div className="flex items-center gap-2.5 bg-white p-5">
      <BrandLockup tone="on-light" />
    </div>
  ),
};
