import * as React from "react";
import { type PanelSize, usePanelRef } from "react-resizable-panels";
import { cn } from "../lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../primitives/resizable";

export type SplitLayoutSide = "left" | "right";

export interface SplitLayoutWidths {
  /** Current width of the left pane in pixels; `undefined` until first measured. */
  readonly left: number | undefined;
  /** Current width of the right pane in pixels; `undefined` until first measured. */
  readonly right: number | undefined;
}

export interface PaneWidth {
  readonly side: SplitLayoutSide;
  /** Current width of this pane in pixels; `undefined` until first measured. */
  readonly width: number | undefined;
}

const SplitLayoutWidthsContext = React.createContext<SplitLayoutWidths | undefined>(undefined);
const PaneSideContext = React.createContext<SplitLayoutSide | undefined>(undefined);

/**
 * Widths of both panes of the nearest enclosing `ResizableSplitLayout`, or `undefined`
 * when rendered outside one. Updates live while the user drags the handle and when the
 * layout itself is resized (e.g. a window resize).
 */
function useSplitLayoutWidths(): SplitLayoutWidths | undefined {
  return React.useContext(SplitLayoutWidthsContext);
}

/**
 * Width of the pane the calling component is rendered in, so content can adapt to the
 * space it actually has rather than to the viewport. Returns `undefined` when rendered
 * outside a `ResizableSplitLayout` pane.
 */
function usePaneWidth(): PaneWidth | undefined {
  const widths = React.useContext(SplitLayoutWidthsContext);
  const side = React.useContext(PaneSideContext);
  if (!widths || !side) return undefined;
  return { side, width: widths[side] };
}

/**
 * Panel sizes: numbers are pixels, unit-less strings are percentages (e.g. `"30"`), and
 * strings may carry an explicit unit (`"20rem"`, `"25%"`). Same convention as
 * `react-resizable-panels`.
 */
type PanelSizeValue = number | string;

export interface ResizableSplitLayoutProps {
  readonly left: React.ReactNode;
  readonly right: React.ReactNode;
  /** Initial left pane size. Defaults to half the layout unless `defaultRightSize` is set. */
  readonly defaultLeftSize?: PanelSizeValue;
  /** Initial right pane size; the left pane takes the remaining space. */
  readonly defaultRightSize?: PanelSizeValue;
  readonly minLeftSize?: PanelSizeValue;
  readonly maxLeftSize?: PanelSizeValue;
  readonly minRightSize?: PanelSizeValue;
  readonly maxRightSize?: PanelSizeValue;
  /**
   * Lets the right pane collapse to `rightCollapsedSize`, either by dragging it below its
   * minimum size or through `rightCollapsed`. Its content stays mounted while collapsed.
   */
  readonly rightCollapsible?: boolean;
  /** Right pane size while collapsed. Defaults to 0. */
  readonly rightCollapsedSize?: PanelSizeValue;
  /** Controlled collapsed state of the right pane; requires `rightCollapsible`. */
  readonly rightCollapsed?: boolean;
  /** Called when the right pane collapses or expands, including by dragging. */
  readonly onRightCollapsedChange?: (collapsed: boolean) => void;
  /** Accessible name for the drag handle. */
  readonly handleLabel?: string;
  /** Renders a visible grip on the drag handle. */
  readonly withHandle?: boolean;
  /** Called with both pane widths in pixels whenever either changes. */
  readonly onWidthsChange?: (widths: SplitLayoutWidths) => void;
  readonly className?: string;
  readonly leftClassName?: string;
  readonly rightClassName?: string;
  readonly handleClassName?: string;
}

/**
 * Two panes side by side, separated by a draggable (and keyboard-operable) handle.
 * Each pane's current pixel width is published to its descendants via `usePaneWidth()`
 * (own pane) and `useSplitLayoutWidths()` (both panes), so nested content can switch
 * layouts based on the space it is given.
 */
function ResizableSplitLayout({
  left,
  right,
  defaultLeftSize,
  defaultRightSize,
  minLeftSize,
  maxLeftSize,
  minRightSize,
  maxRightSize,
  rightCollapsible = false,
  rightCollapsedSize,
  rightCollapsed,
  onRightCollapsedChange,
  handleLabel = "Resize panes",
  withHandle = true,
  onWidthsChange,
  className,
  leftClassName,
  rightClassName,
  handleClassName,
}: Readonly<ResizableSplitLayoutProps>) {
  const [widths, setWidths] = React.useState<SplitLayoutWidths>({
    left: undefined,
    right: undefined,
  });

  const updateWidth = React.useCallback((side: SplitLayoutSide, size: PanelSize) => {
    // Rounded so sub-pixel layout jitter doesn't re-render every consumer.
    const width = Math.round(size.inPixels);
    setWidths((prev) => (prev[side] === width ? prev : { ...prev, [side]: width }));
  }, []);

  const onWidthsChangeRef = React.useRef(onWidthsChange);
  React.useEffect(() => {
    onWidthsChangeRef.current = onWidthsChange;
  });
  React.useEffect(() => {
    if (widths.left !== undefined && widths.right !== undefined) {
      onWidthsChangeRef.current?.(widths);
    }
  }, [widths]);

  // Sync the controlled `rightCollapsed` prop into the panel, and report collapses the user
  // causes by dragging back out. Comparing against the panel's own state keeps the two from
  // ping-ponging: the effect only acts on a real mismatch, and `onResize` only reports a change.
  const rightPanelRef = usePanelRef();
  const rightCollapsedRef = React.useRef<boolean | undefined>(undefined);
  React.useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel || rightCollapsed === undefined || panel.isCollapsed() === rightCollapsed) return;
    if (rightCollapsed) panel.collapse();
    else panel.expand();
  }, [rightCollapsed, rightPanelRef]);

  const handleRightResize = (size: PanelSize) => {
    updateWidth("right", size);
    const collapsed = rightPanelRef.current?.isCollapsed() ?? false;
    if (rightCollapsedRef.current !== undefined && rightCollapsedRef.current !== collapsed) {
      onRightCollapsedChange?.(collapsed);
    }
    rightCollapsedRef.current = collapsed;
  };

  return (
    <SplitLayoutWidthsContext.Provider value={widths}>
      <ResizablePanelGroup
        data-slot="resizable-split-layout"
        orientation="horizontal"
        className={cn("min-h-0", className)}
      >
        <ResizablePanel
          id="left"
          defaultSize={defaultLeftSize ?? (defaultRightSize === undefined ? "50" : undefined)}
          minSize={minLeftSize}
          maxSize={maxLeftSize}
          onResize={(size) => updateWidth("left", size)}
          className={leftClassName}
        >
          <PaneSideContext.Provider value="left">{left}</PaneSideContext.Provider>
        </ResizablePanel>
        <ResizableHandle
          withHandle={withHandle}
          aria-label={handleLabel}
          className={handleClassName}
        />
        <ResizablePanel
          id="right"
          panelRef={rightPanelRef}
          defaultSize={defaultRightSize}
          minSize={minRightSize}
          maxSize={maxRightSize}
          collapsible={rightCollapsible}
          collapsedSize={rightCollapsedSize}
          onResize={handleRightResize}
          className={rightClassName}
        >
          <PaneSideContext.Provider value="right">{right}</PaneSideContext.Provider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SplitLayoutWidthsContext.Provider>
  );
}

export { ResizableSplitLayout, usePaneWidth, useSplitLayoutWidths };
