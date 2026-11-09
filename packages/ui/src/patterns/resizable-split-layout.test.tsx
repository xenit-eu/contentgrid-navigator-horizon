import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("gives each instance its own panel ids, so handles control their own panels", () => {
    const { container } = render(
      <>
        <ResizableSplitLayout left="A left" right="A right" handleLabel="Resize A" />
        <ResizableSplitLayout left="B left" right="B right" handleLabel="Resize B" />
      </>,
    );

    const ids = Array.from(container.querySelectorAll("[data-panel]"), (panel) => panel.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain("left");
    expect(ids).not.toContain("right");

    for (const name of ["A", "B"]) {
      const controlled = screen
        .getByRole("separator", { name: `Resize ${name}` })
        .getAttribute("aria-controls");
      expect(controlled).toBeTruthy();
      expect(container.querySelector(`[id="${controlled}"]`)).toHaveTextContent(`${name} `);
    }
  });

  describe("stackBelow", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function mockLayoutWidth(width: number) {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ width, height: 400 }),
      );
    }

    function WidthProbe() {
      const pane = usePaneWidth();
      return <span>{`${pane?.side}:${pane?.width}`}</span>;
    }

    it("stacks the panes, split by a horizontal handle, below the threshold", () => {
      mockLayoutWidth(500);
      const onWidthsChange = vi.fn();
      const { container } = render(
        <ResizableSplitLayout
          left={<WidthProbe />}
          right={<WidthProbe />}
          handleLabel="Resize"
          onWidthsChange={onWidthsChange}
          stackBelow={800}
        />,
      );

      expect(container.querySelector("[data-slot=resizable-split-layout]")).toHaveAttribute(
        "data-stacked",
      );
      expect(screen.getByRole("separator", { name: "Resize" })).toHaveAttribute(
        "aria-orientation",
        "horizontal",
      );
      // Stacked, both panes span the layout's full width.
      expect(screen.getByText("left:500")).toBeInTheDocument();
      expect(screen.getByText("right:500")).toBeInTheDocument();
      expect(onWidthsChange).toHaveBeenLastCalledWith({ left: 500, right: 500 });
    });

    it("keeps the panes side by side from the threshold up", () => {
      mockLayoutWidth(800);
      const { container } = render(
        <ResizableSplitLayout left="Left" right="Right" handleLabel="Resize" stackBelow={800} />,
      );

      expect(container.querySelector("[data-slot=resizable-split-layout]")).not.toHaveAttribute(
        "data-stacked",
      );
      expect(screen.getByRole("separator", { name: "Resize" })).toHaveAttribute(
        "aria-orientation",
        "vertical",
      );
    });
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
