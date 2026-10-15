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
  /**
   * When `false`, the panes keep their sizes and the handle can't be dragged or moved with the
   * keyboard; it renders as a plain divider without the grip. Collapsing the right pane through
   * `rightCollapsed` still works. Defaults to `true`.
   */
  readonly resizable?: boolean;
  /**
   * Stacks the panes vertically (left on top, filling the remaining height; right below at its
   * content height) and hides the handle. Both panes stay mounted when this flips, so their
   * content keeps its state across a breakpoint. While stacked, both panes report the layout's
   * full width. Defaults to `false`.
   */
  readonly stacked?: boolean;
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
  resizable = true,
  stacked = false,
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

  // While stacked, the library still lays the panes out side by side internally, so its
  // reported sizes don't match what's on screen; both panes span the layout's own width instead.
  const [groupElement, setGroupElement] = React.useState<HTMLDivElement | null>(null);
  const [stackedWidth, setStackedWidth] = React.useState<number | undefined>(undefined);
  React.useLayoutEffect(() => {
    if (!stacked || !groupElement) return;
    const measure = () => setStackedWidth(Math.round(groupElement.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(groupElement);
    return () => observer.disconnect();
  }, [stacked, groupElement]);
  const publishedWidths = React.useMemo<SplitLayoutWidths>(
    () => (stacked ? { left: stackedWidth, right: stackedWidth } : widths),
    [stacked, stackedWidth, widths],
  );

  const onWidthsChangeRef = React.useRef(onWidthsChange);
  React.useEffect(() => {
    onWidthsChangeRef.current = onWidthsChange;
  });
  React.useEffect(() => {
    if (publishedWidths.left !== undefined && publishedWidths.right !== undefined) {
      onWidthsChangeRef.current?.(publishedWidths);
    }
  }, [publishedWidths]);

  // The library writes panel ids into the DOM (`id`, `data-testid`, the handle's
  // `aria-controls`), so they must be unique per instance.
  const idPrefix = React.useId();

  // `rightCollapsed` is the source of truth for the right pane's collapsed state. Only a
  // collapse or expand the user causes on the handle (dragging past the minimum size, or the
  // keyboard) is reported back. Any other change the library makes on its own (e.g. restoring the
  // layout it had before the panes were stacked) is reverted to `rightCollapsed` instead, at most
  // once per change of `rightCollapsed`/`stacked` so a panel that can't be expanded can't loop.
  // While stacked the panel's size isn't what's on screen, so it is left alone entirely.
  const rightPanelRef = usePanelRef();
  const userResizingRef = React.useRef(false);
  const lastCollapsedRef = React.useRef<boolean | undefined>(undefined);
  const revertedRef = React.useRef(false);

  const syncRightPanel = React.useCallback(() => {
    const panel = rightPanelRef.current;
    if (stacked || !panel || rightCollapsed === undefined) return;
    if (panel.isCollapsed() === rightCollapsed) return;
    if (rightCollapsed) panel.collapse();
    else panel.expand();
  }, [rightCollapsed, rightPanelRef, stacked]);

  React.useEffect(() => {
    revertedRef.current = false;
    syncRightPanel();
  }, [syncRightPanel]);

  React.useEffect(() => {
    const stopResizing = () => {
      userResizingRef.current = false;
    };
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    return () => {
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, []);

  const handleRightResize = (size: PanelSize) => {
    updateWidth("right", size);
    const panel = rightPanelRef.current;
    if (stacked || !panel) return;
    const collapsed = panel.isCollapsed();
    const previous = lastCollapsedRef.current;
    lastCollapsedRef.current = collapsed;
    if (userResizingRef.current) {
      if (previous !== undefined && previous !== collapsed) onRightCollapsedChange?.(collapsed);
    } else if (
      rightCollapsed !== undefined &&
      collapsed !== rightCollapsed &&
      !revertedRef.current
    ) {
      revertedRef.current = true;
      // Deferred: the library is still inside its own layout update here.
      queueMicrotask(syncRightPanel);
    }
  };

  return (
    <SplitLayoutWidthsContext.Provider value={publishedWidths}>
      <ResizablePanelGroup
        data-slot="resizable-split-layout"
        data-stacked={stacked || undefined}
        orientation="horizontal"
        elementRef={setGroupElement}
        className={cn(
          "min-h-0",
          // The library sets the flex direction and each panel's flex sizing inline, so stacking
          // has to override them with `!important`.
          stacked &&
            "flex-col! gap-4 [&>[data-pane=left]]:min-h-0 [&>[data-pane=left]]:shrink! [&>[data-pane=left]]:grow! [&>[data-pane=left]]:basis-0! [&>[data-pane=right]]:shrink-0! [&>[data-pane=right]]:grow-0! [&>[data-pane=right]]:basis-auto!",
          className,
        )}
      >
        {/* While stacked, size constraints are left out: the library would resolve pixel sizes
          against the column layout and keep those values after un-stacking. Passing them again
          when un-stacking makes it resolve them against the side-by-side layout. */}
        <ResizablePanel
          id={`${idPrefix}-left`}
          data-pane="left"
          defaultSize={defaultLeftSize ?? (defaultRightSize === undefined ? "50" : undefined)}
          minSize={stacked ? undefined : minLeftSize}
          maxSize={stacked ? undefined : maxLeftSize}
          onResize={(size) => updateWidth("left", size)}
          className={leftClassName}
        >
          <PaneSideContext.Provider value="left">{left}</PaneSideContext.Provider>
        </ResizablePanel>
        <ResizableHandle
          withHandle={withHandle && resizable}
          disabled={!resizable || stacked}
          aria-label={handleLabel}
          onPointerDown={() => {
            userResizingRef.current = true;
          }}
          onKeyDown={() => {
            userResizingRef.current = true;
          }}
          onKeyUp={() => {
            userResizingRef.current = false;
          }}
          className={cn(handleClassName, stacked && "hidden")}
        />
        <ResizablePanel
          id={`${idPrefix}-right`}
          data-pane="right"
          panelRef={rightPanelRef}
          defaultSize={defaultRightSize}
          minSize={stacked ? undefined : minRightSize}
          maxSize={stacked ? undefined : maxRightSize}
          collapsible={rightCollapsible}
          collapsedSize={stacked ? undefined : rightCollapsedSize}
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
