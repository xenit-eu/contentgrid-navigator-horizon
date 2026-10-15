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

  it("stacked: hides and disables the handle but keeps both panes rendered", () => {
    const { container } = render(
      <ResizableSplitLayout
        left={<PaneProbe />}
        right={<PaneProbe />}
        handleLabel="Resize"
        stacked
      />,
    );

    expect(container.querySelector("[data-slot=resizable-split-layout]")).toHaveAttribute(
      "data-stacked",
    );
    const handle = screen.getByRole("separator", { name: "Resize", hidden: true });
    expect(handle).toHaveClass("hidden");
    expect(handle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("side:left")).toBeInTheDocument();
    expect(screen.getByText("side:right")).toBeInTheDocument();
  });

  describe("stacked widths", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("reports the layout's full width for both panes", () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ width: 500, height: 400 }),
      );
      const onWidthsChange = vi.fn();
      function WidthProbe() {
        const pane = usePaneWidth();
        return <span>{`${pane?.side}:${pane?.width}`}</span>;
      }

      render(
        <ResizableSplitLayout
          left={<WidthProbe />}
          right={<WidthProbe />}
          onWidthsChange={onWidthsChange}
          stacked
        />,
      );

      expect(screen.getByText("left:500")).toBeInTheDocument();
      expect(screen.getByText("right:500")).toBeInTheDocument();
      expect(onWidthsChange).toHaveBeenLastCalledWith({ left: 500, right: 500 });
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
