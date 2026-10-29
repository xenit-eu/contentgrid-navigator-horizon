import { forwardRef, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretRightIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  Button,
  ResizableSplitLayout,
  type SplitPaneHandle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@contentgrid/ui";

/** Below this layout width the two regions stack vertically instead of side by side. */
const WIDE_LAYOUT_MIN_WIDTH = 800;
/** Width of the side panel's rail when collapsed side by side. */
const RAIL_WIDTH = 48;
/** Height of the side panel's header bar, which is all that shows when collapsed while stacked. */
const STACKED_RAIL_HEIGHT = 46;

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
   * When `false` the panel keeps its default size; the show/hide toggle still works. Defaults to `true`.
   */
  readonly resizable?: boolean;
  /** Pads the side panel's body. Turn off for content that runs edge to edge, such as a list of
   * full-width rows. Defaults to `true`. */
  readonly sidePanelPadded?: boolean;
}

/**
 * Generic two-region layout: main content on the left, a collapsible side panel on the right,
 * 400px wide by default, split by a draggable handle (`ResizableSplitLayout`), so descendants of
 * either region can read their region's current width via `usePaneWidth()` from
 * `@contentgrid/ui`. Dragging the panel below its minimum size collapses it to the rail, same as
 * the toggle. When the layout itself (not the viewport) is narrower than 800px, the panel moves
 * below the content, still resizable, and collapses to its header bar; both regions stay mounted
 * across that breakpoint. Fills the available height with no nested scrollbars — each region
 * owns its own `overflow`/`min-h-0` so only that region scrolls, never the page. Forwards `ref`
 * to the outer element so a caller can request fullscreen on the whole layout (e.g. a PDF
 * viewer's own fullscreen mode).
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
      sidePanelPadded = true,
    },
    ref,
  ) {
    const [open, setOpen] = useState(defaultSidePanelOpen);
    const toggleLabel = open ? `Hide ${sidePanelTitle}` : `Show ${sidePanelTitle}`;

    // The library owns the panel's size and collapsed state: the toggle asks it to collapse or
    // expand, and `open` follows whatever it reports (including drags and breakpoint changes).
    const panelRef = useRef<SplitPaneHandle>(null);
    const toggle = (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) panelRef.current?.expand();
      else panelRef.current?.collapse();
    };
    // Initial sizes only; changing them later would make the library re-register the panel.
    const [initiallyOpen] = useState(defaultSidePanelOpen);

    const sidePanelRegion = (
      <div
        // Fills the resizable panel, whose size (the rail when collapsed) sets its dimensions.
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border"
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
                    onClick={() => toggle(false)}
                  >
                    <CaretRightIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{toggleLabel}</TooltipContent>
              </Tooltip>
            </div>
            <div
              className={
                sidePanelPadded
                  ? "min-h-0 flex-1 overflow-auto p-3"
                  : "min-h-0 flex-1 overflow-auto"
              }
            >
              {sidePanel}
            </div>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The whole rail is the toggle when collapsed — one tab stop, not a small
                button above an empty body. `py-1.5` + the size-8 icon box replicate the
                open header row's own `py-1.5` + icon-sm centering, so the sliders icon
                lands at the same offset from the rail's top edge in both states (and still
                lines up with PdfViewerToolbar's row). `flex-1` stretches the button to
                fill the whole rail: the full height side by side, the full width when stacked. `ring-inset` keeps the focus
                ring inside the rail's `overflow-hidden` bounds instead of being clipped. */}
              <button
                type="button"
                aria-label={toggleLabel}
                aria-expanded={open}
                onClick={() => toggle(true)}
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
        <div ref={ref} className="h-full min-h-0">
          <ResizableSplitLayout
            left={<div className="h-full min-h-0 min-w-0 overflow-hidden">{children}</div>}
            right={sidePanelRegion}
            defaultRightSize={initiallyOpen ? 400 : RAIL_WIDTH}
            minRightSize={360}
            maxRightSize="60"
            minLeftSize={320}
            rightCollapsedSize={RAIL_WIDTH}
            stackBelow={WIDE_LAYOUT_MIN_WIDTH}
            stackedSizes={{
              defaultRightSize: initiallyOpen ? "40" : STACKED_RAIL_HEIGHT,
              minRightSize: 120,
              minLeftSize: 200,
              rightCollapsedSize: STACKED_RAIL_HEIGHT,
            }}
            rightCollapsible
            rightPanelRef={panelRef}
            onRightCollapsedChange={(collapsed) => setOpen(!collapsed)}
            resizable={resizable}
            handleLabel={`Resize ${sidePanelTitle}`}
            // Sits on the panel's own border rather than in the gap: the margin keeps the gap the
            // grid's `gap-4` used to leave, the negative margin pulls the 1px handle over the
            // panel's border (taking no space of its own), and it stays transparent so that border
            // line runs straight through the grip. `z-10` keeps it above the panel. A side-by-side
            // split has a vertical handle (`aria-orientation=vertical`), a stacked one a horizontal.
            handleClassName="z-10 bg-transparent aria-[orientation=vertical]:ml-4 aria-[orientation=vertical]:-mr-px aria-[orientation=horizontal]:mt-4 aria-[orientation=horizontal]:-mb-px"
          />
        </div>
      </TooltipProvider>
    );
  },
);
