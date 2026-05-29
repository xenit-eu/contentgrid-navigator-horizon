import type { Meta, StoryObj } from "@storybook/react";
import { InfoIcon } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon">
            <InfoIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>More information</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const OnText: Story = {
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
