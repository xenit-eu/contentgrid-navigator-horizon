import * as React from "react";
import { type PanelImperativeHandle, type PanelSize, usePanelRef } from "react-resizable-panels";
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

/** Imperative handle to the right pane: `collapse()`, `expand()`, `isCollapsed()`, `resize()`. */
export type SplitPaneHandle = PanelImperativeHandle;

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

/** Pane sizes along the split axis: widths side by side, heights when stacked. */
export interface SplitPaneSizes {
  /** Initial left pane size. Defaults to half the layout unless `defaultRightSize` is set. */
  readonly defaultLeftSize?: PanelSizeValue;
  /** Initial right pane size; the left pane takes the remaining space. */
  readonly defaultRightSize?: PanelSizeValue;
  readonly minLeftSize?: PanelSizeValue;
  readonly maxLeftSize?: PanelSizeValue;
  readonly minRightSize?: PanelSizeValue;
  readonly maxRightSize?: PanelSizeValue;
  /** Right pane size while collapsed. Defaults to 0. */
  readonly rightCollapsedSize?: PanelSizeValue;
}

export interface ResizableSplitLayoutProps extends SplitPaneSizes {
  readonly left: React.ReactNode;
  readonly right: React.ReactNode;
  /**
   * Below this layout width (in pixels) the panes stack vertically, left on top, still split by
   * a draggable handle. The panes stay mounted when the layout crosses it.
   */
  readonly stackBelow?: number;
  /** Pane heights while stacked; used instead of the top-level sizes, which are widths. */
  readonly stackedSizes?: SplitPaneSizes;
  /**
   * Lets the right pane collapse to `rightCollapsedSize` by dragging it below its minimum size,
   * or through `rightPanelRef`. Its content stays mounted while collapsed.
   */
  readonly rightCollapsible?: boolean;
  /** Imperative handle to the right pane, e.g. to collapse or expand it from a button. */
  readonly rightPanelRef?: React.Ref<SplitPaneHandle>;
  /** Called when the right pane collapses or expands, whatever caused it. */
  readonly onRightCollapsedChange?: (collapsed: boolean) => void;
  /**
   * When `false`, the panes keep their sizes and the handle can't be dragged or moved with the
   * keyboard; it renders as a plain divider without the grip. Collapsing the right pane through
   * `rightPanelRef` still works. Defaults to `true`.
   */
  readonly resizable?: boolean;
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
 * Two panes separated by a draggable (and keyboard-operable) handle: side by side, or stacked
 * below `stackBelow`. Each pane's current pixel width is published to its descendants via
 * `usePaneWidth()` (own pane) and `useSplitLayoutWidths()` (both panes), so nested content can
 * switch layouts based on the space it is given. Sizing and collapsing are left entirely to
 * `react-resizable-panels`; this component only reports what it does.
 */
function ResizableSplitLayout({
  left,
  right,
  stackBelow,
  stackedSizes,
  rightCollapsible = false,
  rightPanelRef,
  onRightCollapsedChange,
  resizable = true,
  handleLabel = "Resize panes",
  withHandle = true,
  onWidthsChange,
  className,
  leftClassName,
  rightClassName,
  handleClassName,
  ...sideBySideSizes
}: Readonly<ResizableSplitLayoutProps>) {
  // The layout's own width picks the orientation, and is each pane's width while stacked. The
  // panes only render once it is known (measured before the first paint), so they never lay out
  // in the wrong orientation first.
  const [element, setElement] = React.useState<HTMLDivElement | null>(null);
  const [layoutWidth, setLayoutWidth] = React.useState<number | undefined>(undefined);
  React.useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setLayoutWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  const stacked = stackBelow !== undefined && layoutWidth !== undefined && layoutWidth < stackBelow;
  const sizes = stacked ? (stackedSizes ?? {}) : sideBySideSizes;

  // Side by side, the library reports each pane's width (rounded so sub-pixel layout jitter
  // doesn't re-render every consumer). Stacked, it reports heights, so both panes get the
  // layout's width instead.
  const [paneWidths, setPaneWidths] = React.useState<SplitLayoutWidths>({
    left: undefined,
    right: undefined,
  });
  const updateWidth = (side: SplitLayoutSide, size: PanelSize) => {
    if (stacked) return;
    const width = Math.round(size.inPixels);
    setPaneWidths((prev) => (prev[side] === width ? prev : { ...prev, [side]: width }));
  };
  const widths = React.useMemo<SplitLayoutWidths>(
    () => (stacked ? { left: layoutWidth, right: layoutWidth } : paneWidths),
    [stacked, layoutWidth, paneWidths],
  );

  const onWidthsChangeRef = React.useRef(onWidthsChange);
  React.useEffect(() => {
    onWidthsChangeRef.current = onWidthsChange;
  });
  React.useEffect(() => {
    if (widths.left !== undefined && widths.right !== undefined) {
      onWidthsChangeRef.current?.(widths);
    }
  }, [widths]);

  const panelRef = usePanelRef();
  React.useImperativeHandle(rightPanelRef, () => panelRef.current as SplitPaneHandle);
  const collapsedRef = React.useRef<boolean | undefined>(undefined);
  const handleRightResize = (size: PanelSize) => {
    updateWidth("right", size);
    const collapsed = panelRef.current?.isCollapsed() ?? false;
    if (collapsedRef.current !== undefined && collapsedRef.current !== collapsed) {
      onRightCollapsedChange?.(collapsed);
    }
    collapsedRef.current = collapsed;
  };

  // The library writes panel ids into the DOM (`id`, `data-testid`, the handle's
  // `aria-controls`), so they must be unique per instance.
  const idPrefix = React.useId();

  return (
    <div
      ref={setElement}
      data-slot="resizable-split-layout"
      data-stacked={stacked || undefined}
      className={cn("h-full w-full min-h-0", className)}
    >
      {layoutWidth !== undefined && (
        <SplitLayoutWidthsContext.Provider value={widths}>
          <ResizablePanelGroup orientation={stacked ? "vertical" : "horizontal"}>
            <ResizablePanel
              id={`${idPrefix}-left`}
              defaultSize={
                sizes.defaultLeftSize ?? (sizes.defaultRightSize === undefined ? "50" : undefined)
              }
              minSize={sizes.minLeftSize}
              maxSize={sizes.maxLeftSize}
              onResize={(size) => updateWidth("left", size)}
              className={leftClassName}
            >
              <PaneSideContext.Provider value="left">{left}</PaneSideContext.Provider>
            </ResizablePanel>
            <ResizableHandle
              withHandle={withHandle && resizable}
              disabled={!resizable}
              aria-label={handleLabel}
              className={handleClassName}
            />
            <ResizablePanel
              id={`${idPrefix}-right`}
              panelRef={panelRef}
              defaultSize={sizes.defaultRightSize}
              minSize={sizes.minRightSize}
              maxSize={sizes.maxRightSize}
              collapsible={rightCollapsible}
              collapsedSize={sizes.rightCollapsedSize}
              onResize={handleRightResize}
              className={rightClassName}
            >
              <PaneSideContext.Provider value="right">{right}</PaneSideContext.Provider>
            </ResizablePanel>
          </ResizablePanelGroup>
        </SplitLayoutWidthsContext.Provider>
      )}
    </div>
  );
}

export { ResizableSplitLayout, usePaneWidth, useSplitLayoutWidths };
