import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Filter</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <PopoverHeader>
          <PopoverTitle>Quick filter</PopoverTitle>
          <PopoverDescription>Narrow down results.</PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 grid gap-2">
          <Label htmlFor="ia-popover-search">Search</Label>
          <Input id="ia-popover-search" placeholder="Type to search…" />
        </div>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /filter/i });
    await userEvent.click(trigger);
    // Wait for the portal to mount and the popover to become visible
    let popover: HTMLElement;
    await waitFor(() => {
      popover = within(document.body).getByRole("dialog");
      expect(popover).toBeVisible();
    });
    await expect(within(document.body).getByText(/quick filter/i)).toBeInTheDocument();
    await expect(within(document.body).getByText(/narrow down results/i)).toBeInTheDocument();
    // Input must be rendered inside the popover portal
    const searchInput = within(document.body).getByRole("textbox", { name: /search/i });
    await expect(searchInput).toBeInTheDocument();
  },
};
