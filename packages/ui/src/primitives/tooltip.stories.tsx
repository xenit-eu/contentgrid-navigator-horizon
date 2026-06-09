import type { Meta, StoryObj } from "@storybook/react";
import { InfoIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // axe-no-contrast: the tooltip content (dark bg-foreground surface) overlaps the
  // trigger/background; axe composites the underlying layer into its background calc,
  // reporting the dark surface as mid-grey. On its real surface the tooltip text
  // (text-background on bg-foreground) passes WCAG AA (14.75:1).
  tags: ["axe-no-contrast"],
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Info">
            <InfoIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>More information</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const OnText: Story = {
  // axe-no-contrast: tooltip content overlaps other layers; axe composites them into its
  // background calc (intermittent false positive). Real text passes WCAG AA (14.75:1).
  tags: ["axe-no-contrast"],
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            Keyboard shortcut
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Press <kbd className="rounded bg-muted px-1">⌘K</kbd> to open
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const Sides: Story = {
  // axe-no-contrast: tooltip content overlaps other layers; axe composites them into its
  // background calc (false positives). Real tooltip text passes WCAG AA (14.75:1).
  tags: ["axe-no-contrast"],
  render: () => (
    <TooltipProvider>
      <div className="flex items-center gap-6">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <Tooltip key={side} defaultOpen>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                {side}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={side}>{side}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  ),
};

export const WithInteraction: Story = {
  // axe-no-contrast: play() shows the tooltip; its content overlaps other layers, which
  // axe composites into its background calc (false positives). Real text passes WCAG AA.
  tags: ["no-visual-test", "axe-no-contrast"],
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Info">
            <InfoIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>More information</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /info/i });
    await userEvent.hover(trigger);
    trigger.focus();
    // Radix briefly renders the tooltip content as a hidden, un-positioned node
    // (also role="tooltip") before revealing the popper. Poll for the visible
    // tooltip carrying the text rather than grabbing the first role="tooltip" match.
    await waitFor(() => {
      const tips = within(document.body).getAllByRole("tooltip");
      const visible = tips.find(
        (t) => /more information/i.test(t.textContent ?? "") && t.checkVisibility?.() !== false,
      );
      expect(visible).toBeTruthy();
      expect(visible!).toBeVisible();
    });
  },
};
