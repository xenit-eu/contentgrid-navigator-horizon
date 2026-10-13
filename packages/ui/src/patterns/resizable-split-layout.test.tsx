import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizableSplitLayout, usePaneWidth, useSplitLayoutWidths } from "./resizable-split-layout";

function PaneProbe() {
  const pane = usePaneWidth();
  return <span>{pane ? `side:${pane.side}` : "no-pane"}</span>;
}

function WidthsProbe() {
  const widths = useSplitLayoutWidths();
  return <span>{widths ? "has-widths" : "no-widths"}</span>;
}

describe("ResizableSplitLayout", () => {
  it("renders both panes and an accessible resize handle", () => {
    render(<ResizableSplitLayout left="Left content" right="Right content" handleLabel="Resize" />);
    expect(screen.getByText("Left content")).toBeInTheDocument();
    expect(screen.getByText("Right content")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize" })).toBeInTheDocument();
  });

  it("tells each pane's descendants which side they are on", () => {
    render(<ResizableSplitLayout left={<PaneProbe />} right={<PaneProbe />} />);
    expect(screen.getByText("side:left")).toBeInTheDocument();
    expect(screen.getByText("side:right")).toBeInTheDocument();
  });

  it("exposes both pane widths to descendants", () => {
    render(<ResizableSplitLayout left={<WidthsProbe />} right={null} />);
    expect(screen.getByText("has-widths")).toBeInTheDocument();
  });

  it("returns undefined outside a split layout", () => {
    render(
      <>
        <PaneProbe />
        <WidthsProbe />
      </>,
    );
    expect(screen.getByText("no-pane")).toBeInTheDocument();
    expect(screen.getByText("no-widths")).toBeInTheDocument();
  });
});
