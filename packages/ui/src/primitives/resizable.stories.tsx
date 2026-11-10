import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

const meta = {
  title: "Primitives/Resizable",
  component: ResizablePanelGroup,
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Pane({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <div className="h-48 w-[32rem] rounded-md border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="50">
          <Pane label="One" />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="50">
          <Pane label="Two" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const WithHandle: Story = {
  render: () => (
    <div className="h-48 w-[32rem] rounded-md border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="30" minSize="20">
          <Pane label="Sidebar" />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="70">
          <Pane label="Content" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="h-64 w-80 rounded-md border">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="40">
          <Pane label="Header" />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="60">
          <Pane label="Content" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="h-48 w-[32rem] rounded-md border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="50">
          <Pane label="One" />
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize" />
        <ResizablePanel defaultSize="50">
          <Pane label="Two" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("separator", { name: "Resize" });
    const before = Number(handle.getAttribute("aria-valuenow"));
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  },
};
