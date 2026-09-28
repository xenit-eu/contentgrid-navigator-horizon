import { forwardRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretRightIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@contentgrid/ui";

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
}

/**
 * Generic two-region layout: main content on the left, a collapsible side panel on the right at
 * `1fr / 360px`. Fills the available height with no nested scrollbars — each region owns its own
 * `overflow`/`min-h-0` so only that region scrolls, never the page. Stacks vertically below
 * 800px. Forwards `ref` to the outer element so a caller can request fullscreen on the whole
 * layout (e.g. a PDF viewer's own fullscreen mode).
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
    },
    ref,
  ) {
    const [open, setOpen] = useState(defaultSidePanelOpen);
    const toggleLabel = open ? `Hide ${sidePanelTitle}` : `Show ${sidePanelTitle}`;

    return (
      <TooltipProvider>
        <div
          ref={ref}
          className={[
            "grid h-full min-h-0 grid-cols-1 gap-4",
            open ? "min-[800px]:grid-cols-[1fr_360px]" : "min-[800px]:grid-cols-[1fr_auto]",
          ].join(" ")}
        >
          <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
          <div
            className={[
              "flex min-h-0 flex-col overflow-hidden rounded-lg border",
              open ? "" : "min-[800px]:w-12",
            ].join(" ")}
          >
            {open ? (
              <>
                {/* px-2 py-1.5 + icon-sm matches PdfViewerToolbar's row so both bars line up */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
                  <div className="min-w-0 flex-1 truncate">
                    {sidePanelHeader ?? (
                      <span className="text-sm font-semibold">{sidePanelTitle}</span>
                    )}
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
                      (rail is a full-width row, not `w-12`) it keeps the icon centered on a
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
        </div>
      </TooltipProvider>
    );
  },
);
