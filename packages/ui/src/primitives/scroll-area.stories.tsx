import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ScrollArea, ScrollBar } from "./scroll-area";
import { Separator } from "./separator";

const meta = {
  title: "Primitives/ScrollArea",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-64 w-48 rounded-md border">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium leading-none">Notifications</h4>
        {items.map((item) => (
          <div key={item}>
            <p className="text-sm">{item}</p>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-80 rounded-md border whitespace-nowrap">
      <div className="flex gap-4 p-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-muted text-sm"
          >
            Photo {i + 1}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <ScrollArea className="h-40 w-48 rounded-md border">
      <div className="p-4">
        <h4 className="mb-2 text-sm font-medium">Items</h4>
        {items.map((item) => (
          <p key={item} className="text-sm">
            {item}
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The scroll area container should be in the DOM
    await expect(canvas.getByText("Item 1")).toBeInTheDocument();
    // Last item is in the DOM even if not visible (scroll area renders all children)
    await expect(canvas.getByText("Item 30")).toBeInTheDocument();
  },
};
