import { forwardRef, useCallback, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { CaretRightIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  Button,
  ResizableSplitLayout,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@contentgrid/ui";

/** Below this layout width the two regions stack vertically instead of side by side. */
const WIDE_LAYOUT_MIN_WIDTH = 800;

/**
 * Whether the layout's own box (not the viewport — the app sidebar or a host container can make
 * it much narrower) is wide enough for side-by-side regions. `undefined` until measured, which
 * happens in a layout effect, so the first paint already uses the right arrangement.
 */
function useIsWideLayout(): [boolean | undefined, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [isWide, setIsWide] = useState<boolean | undefined>(undefined);

  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setIsWide(element.getBoundingClientRect().width >= WIDE_LAYOUT_MIN_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [isWide, setElement];
}

export interface RightSidePanelLayoutProps {
  /** Main content, rendered in the left region. */
  readonly children: ReactNode;
  /** Rendered in the collapsible side panel. */
  readonly sidePanel: ReactNode;
  /**
   * Accessible name for the side panel and its show/hide toggle (`"Hide ${sidePanelTitle}"` /
   * `"Show ${sidePanelTitle}"`, also the tooltip text on that toggle). Defaults to `"Details"`.
   * Also the visual header shown when the panel is open, unless `sidePanelHeader` overrides it.
   */
  readonly sidePanelTitle?: string;
  /**
   * Visual content for the header bar shown when the panel is open — defaults to plain
   * `sidePanelTitle` text. Pass a richer node (e.g. `EntityItemReference`, so the panel shows
   * which item it belongs to instead of a generic label) here; `sidePanelTitle` still supplies
   * the accessible name regardless.
   */
  readonly sidePanelHeader?: ReactNode;
  /** Whether the side panel starts expanded. Defaults to `true`. */
  readonly defaultSidePanelOpen?: boolean;
  /**
   * Whether the user can drag the border between the content and the side panel to resize them
   * (wide layouts only). When `false` the panel keeps its default 360px width; the show/hide
   * toggle still works. Defaults to `true`.
   */
  readonly resizable?: boolean;
}

/**
 * Generic two-region layout: main content on the left, a collapsible side panel on the right,
 * 360px wide by default. From a layout width of 800px up the two are split by a draggable handle
 * (`ResizableSplitLayout`), so descendants of either region can read their region's current
 * width via `usePaneWidth()` from `@contentgrid/ui`; dragging the panel below its minimum width
 * collapses it to the rail, same as the toggle. Fills the available height with no nested
 * scrollbars — each region owns its own `overflow`/`min-h-0` so only that region scrolls, never
 * the page. Stacks vertically, without the handle, when the layout itself is narrower than 800px
 * (measured on its own box rather than the viewport); both regions stay mounted across that
 * breakpoint. Forwards `ref` to the outer element so a
 * caller can request fullscreen on the whole layout (e.g. a PDF viewer's own fullscreen mode).
 *
 * The show/hide toggle is icon-only, so a `Tooltip` carries its accessible name (self-contained
 * in a local `TooltipProvider`, same as `PdfViewerToolbar` — no ancestor provider required).
 * When collapsed, the whole rail is the toggle (one tab stop, no separate header row above an
 * empty body) rather than a small button in a corner.
 *
 * Reused by anything that needs a primary content region plus an auxiliary detail panel — the
 * content-focus entity-item view (`entity-item/variations/content-focus`, spec
 * `contracts/content-focus-view.md`) is one consumer, not the only one this is meant to serve
 * (round-2 review of #192: "since this layout is already very generic, could we move it to
 * features/layout … so it can more easily be reused?").
 */
export const RightSidePanelLayout = forwardRef<HTMLDivElement, RightSidePanelLayoutProps>(
  function RightSidePanelLayout(
    {
      children,
      sidePanel,
      sidePanelTitle = "Details",
      sidePanelHeader,
      defaultSidePanelOpen = true,
      resizable = true,
    },
    ref,
  ) {
    const [open, setOpen] = useState(defaultSidePanelOpen);
    const toggleLabel = open ? `Hide ${sidePanelTitle}` : `Show ${sidePanelTitle}`;

    const [isWide, measureRef] = useIsWideLayout();
    const rootRef = useCallback(
      (element: HTMLDivElement | null) => {
        measureRef(element);
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      },
      [measureRef, ref],
    );
    const sidePanelRegion = (
      <div
        className={[
          "flex min-h-0 flex-col overflow-hidden rounded-lg border",
          // Wide: fills the resizable panel, whose size (48px when collapsed) sets the width.
          // Narrow: a full-width row under the main content.
          isWide === false ? "" : "h-full",
        ].join(" ")}
      >
        {open ? (
          <>
            {/* px-2 py-1.5 + icon-sm matches PdfViewerToolbar's row so both bars line up */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
              <div className="min-w-0 flex-1 truncate">
                {sidePanelHeader ?? <span className="text-sm font-semibold">{sidePanelTitle}</span>}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={toggleLabel}
                    aria-expanded={open}
                    onClick={() => setOpen(false)}
                  >
                    <CaretRightIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{toggleLabel}</TooltipContent>
              </Tooltip>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">{sidePanel}</div>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The whole rail is the toggle when collapsed — one tab stop, not a small
                button above an empty body. `py-1.5` + the size-8 icon box replicate the
                open header row's own `py-1.5` + icon-sm centering, so the sliders icon
                lands at the same offset from the rail's top edge in both states (and still
                lines up with PdfViewerToolbar's row). `flex-1` stretches the button to
                fill the rail's full height on wide screens; on the stacked narrow layout
                (rail is a full-width row, not the 48px collapsed panel) it keeps the icon centered on a
                normal-height bar instead of a tall empty area. `ring-inset` keeps the focus
                ring inside the rail's `overflow-hidden` bounds instead of being clipped. */}
              <button
                type="button"
                aria-label={toggleLabel}
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="flex flex-1 flex-col items-center rounded-lg py-1.5 outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset"
              >
                <span className="flex size-8 items-center justify-center">
                  {/* Sliders/tune icon rather than a plain caret — more indicative of "open
                    the details panel" (round-2 review of #192; matches the old Navigator's
                    own collapsed-panel icon). */}
                  <SlidersHorizontalIcon className="size-4" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{toggleLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );

    return (
      <TooltipProvider>
        <div ref={rootRef} className="h-full min-h-0">
          {/* One tree for both arrangements: below 800px the split layout stacks instead of
            being swapped for another element, so `children` (e.g. a PDF viewer) and the side
            panel stay mounted when the layout crosses the breakpoint. */}
          {isWide !== undefined && (
            <ResizableSplitLayout
              left={<div className="h-full min-h-0 min-w-0 overflow-hidden">{children}</div>}
              right={sidePanelRegion}
              stacked={!isWide}
              defaultRightSize={360}
              minRightSize={280}
              maxRightSize="60"
              minLeftSize={320}
              rightCollapsible
              resizable={resizable}
              rightCollapsedSize={48}
              rightCollapsed={!open}
              onRightCollapsedChange={(collapsed) => setOpen(!collapsed)}
              handleLabel={`Resize ${sidePanelTitle}`}
              // Sits on the panel's own left border rather than in the gap: `ml-4` keeps the
              // gap the grid's `gap-4` used to leave, `-mr-px` pulls the 1px handle over the
              // panel's border (taking no width of its own), and it stays transparent so that
              // border line runs straight through the grip. `z-10` keeps it above the panel.
              handleClassName="z-10 ml-4 -mr-px bg-transparent"
            />
          )}
        </div>
      </TooltipProvider>
    );
  },
);
