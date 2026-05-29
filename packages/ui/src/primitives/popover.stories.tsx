import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = {
  title: "Primitives/Popover",
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Account settings</PopoverTitle>
          <PopoverDescription>Update your display name.</PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 grid gap-2">
          <Label htmlFor="popover-name">Name</Label>
          <Input id="popover-name" defaultValue="Jane Smith" />
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const Simple: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          Help
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p className="text-sm">
          Use keyboard shortcut <kbd className="rounded bg-muted px-1">⌘K</kbd> to open the command
          palette.
        </p>
      </PopoverContent>
    </Popover>
  ),
};
