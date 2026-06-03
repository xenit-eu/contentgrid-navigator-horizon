import type { Meta, StoryObj } from "@storybook/react";
import { ChevronsUpDown } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-64 space-y-2">
      <div className="flex items-center justify-between px-4">
        <span className="text-sm font-semibold">Notifications</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <ChevronsUpDown className="size-4" />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-1 px-4">
        <p className="text-sm">Email digest</p>
        <p className="text-sm">Push notifications</p>
        <p className="text-sm">SMS alerts</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-64 space-y-2">
      <div className="flex items-center justify-between px-4">
        <span className="text-sm font-semibold">Advanced options</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-1 rounded-md border px-4 py-2">
        <p className="text-sm">Custom domain</p>
        <p className="text-sm">API access</p>
        <p className="text-sm">Audit log</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <Collapsible className="w-64 space-y-2">
      <div className="flex items-center justify-between px-4">
        <span className="text-sm font-semibold">Filters</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle filters">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-1 px-4">
        <p className="text-sm">Status filter</p>
        <p className="text-sm">Date range</p>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /toggle filters/i });
    // Content should not be visible initially
    await expect(canvas.queryByText(/status filter/i)).not.toBeInTheDocument();
    // Open
    await userEvent.click(toggle);
    await expect(canvas.getByText(/status filter/i)).toBeVisible();
    // Close
    await userEvent.click(toggle);
    await expect(canvas.queryByText(/status filter/i)).not.toBeInTheDocument();
  },
};
