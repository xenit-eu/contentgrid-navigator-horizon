import { forwardRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@contentgrid/ui";

export interface RightSidePanelLayoutProps {
  /** Main content, rendered in the left region. */
  readonly children: ReactNode;
  /** Rendered in the collapsible side panel. */
  readonly sidePanel: ReactNode;
  /**
   * Accessible name for the side panel and its collapse/expand button (`"Collapse
   * ${sidePanelTitle}"` / `"Expand ${sidePanelTitle}"`). Defaults to `"Details"`. Also the
   * visual header shown when the panel is open, unless `sidePanelHeader` overrides it.
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

    return (
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
          {/* px-2 py-1.5 + icon-sm matches PdfViewerToolbar's row so both bars line up */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
            {open && (
              <div className="min-w-0 flex-1 truncate">
                {sidePanelHeader ?? <span className="text-sm font-semibold">{sidePanelTitle}</span>}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={open ? `Collapse ${sidePanelTitle}` : `Expand ${sidePanelTitle}`}
              aria-expanded={open}
              onClick={() => setOpen((wasOpen) => !wasOpen)}
            >
              {open ? <CaretRightIcon className="size-4" /> : <CaretLeftIcon className="size-4" />}
            </Button>
          </div>
          {open && <div className="min-h-0 flex-1 overflow-auto p-3">{sidePanel}</div>}
        </div>
      </div>
    );
  },
);
