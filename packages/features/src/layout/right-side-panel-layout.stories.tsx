import type { Meta, StoryObj } from "@storybook/react";
import { RightSidePanelLayout } from "./right-side-panel-layout";

const meta = {
  title: "Features/Layout/RightSidePanelLayout",
  component: RightSidePanelLayout,
  tags: ["autodocs"],
} satisfies Meta<typeof RightSidePanelLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function SampleContent() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      PDF viewer goes here
    </div>
  );
}

function SampleSidePanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-3 text-sm">Order number: INV-2024-001</div>
      <div className="rounded-md border p-3 text-sm">Total amount: 1250.00</div>
      <div className="rounded-md border p-3 text-sm">Customer: Acme Corp</div>
    </div>
  );
}

export const Default: Story = {
  args: {
    children: <SampleContent />,
    sidePanel: <SampleSidePanel />,
    sidePanelTitle: "Details",
  },
  render: (args) => (
    <div style={{ height: 600, width: 1000 }}>
      <RightSidePanelLayout {...args} />
    </div>
  ),
};

export const CollapsedByDefault: Story = {
  args: {
    children: <SampleContent />,
    sidePanel: <SampleSidePanel />,
    sidePanelTitle: "Details",
    defaultSidePanelOpen: false,
  },
  render: (args) => (
    <div style={{ height: 600, width: 1000 }}>
      <RightSidePanelLayout {...args} />
    </div>
  ),
};

/** Below the 800px breakpoint the two regions stack vertically instead of side by side. */
export const NarrowViewport: Story = {
  args: {
    children: <SampleContent />,
    sidePanel: <SampleSidePanel />,
    sidePanelTitle: "Details",
  },
  render: (args) => (
    <div style={{ height: 700, width: 480 }}>
      <RightSidePanelLayout {...args} />
    </div>
  ),
};
