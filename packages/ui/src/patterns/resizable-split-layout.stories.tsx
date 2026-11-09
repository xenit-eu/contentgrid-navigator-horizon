import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ResizableSplitLayout, usePaneWidth, useSplitLayoutWidths } from "./resizable-split-layout";

const meta = {
  title: "Patterns/ResizableSplitLayout",
  component: ResizableSplitLayout,
  args: {
    left: null,
    right: null,
  },
} satisfies Meta<typeof ResizableSplitLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

const COMPACT_BREAKPOINT = 320;

/**
 * Stand-in for real pane content: switches between a stacked and a two-column layout
 * based on the width of the pane it sits in, not the viewport.
 */
function ResponsivePaneContent({ title }: { title: string }) {
  const pane = usePaneWidth();
  const compact = pane?.width !== undefined && pane.width < COMPACT_BREAKPOINT;

  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid={`${pane?.side}-pane`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {pane?.width ?? "–"}px · {compact ? "compact" : "regular"}
        </span>
      </div>
      <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
        {["Name", "Status", "Owner", "Updated"].map((label) => (
          <div key={label} className="bg-muted rounded-sm px-2 py-1 text-xs">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BothWidthsReadout() {
  const widths = useSplitLayoutWidths();
  return (
    <p className="text-muted-foreground p-4 text-xs tabular-nums">
      left {widths?.left ?? "–"}px / right {widths?.right ?? "–"}px
    </p>
  );
}

export const Default: Story = {
  render: () => (
    <div className="h-64 w-[48rem] rounded-md border">
      <ResizableSplitLayout
        left={<ResponsivePaneContent title="Records" />}
        right={<ResponsivePaneContent title="Preview" />}
      />
    </div>
  ),
};

export const WithConstraints: Story = {
  render: () => (
    <div className="h-64 w-[48rem] rounded-md border">
      <ResizableSplitLayout
        defaultLeftSize="30"
        minLeftSize={200}
        maxLeftSize="60"
        minRightSize={240}
        left={<ResponsivePaneContent title="Records" />}
        right={
          <div className="flex h-full flex-col">
            <ResponsivePaneContent title="Preview" />
            <BothWidthsReadout />
          </div>
        }
      />
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="h-64 w-[48rem] rounded-md border">
      <ResizableSplitLayout
        handleLabel="Resize records and preview"
        left={<ResponsivePaneContent title="Records" />}
        right={<ResponsivePaneContent title="Preview" />}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftPane = canvas.getByTestId("left-pane");
    await waitFor(() => expect(leftPane).toHaveTextContent("regular"));

    const handle = canvas.getByRole("separator", { name: "Resize records and preview" });
    handle.focus();
    // Home collapses the left pane to its minimum size — well under the compact breakpoint.
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(leftPane).toHaveTextContent("compact"));
  },
};
