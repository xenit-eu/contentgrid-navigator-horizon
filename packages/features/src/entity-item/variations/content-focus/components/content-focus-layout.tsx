import { forwardRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@contentgrid/ui";

export interface ContentFocusLayoutProps {
  /** The content/PDF preview, rendered in the main (left) region. */
  readonly preview: ReactNode;
  /** Attributes + relations, rendered in the collapsible side panel. */
  readonly sidePanel: ReactNode;
  /** Side panel header label. Defaults to `"Details"`. */
  readonly sidePanelTitle?: string;
  /** Whether the side panel starts expanded. Defaults to `true`. */
  readonly defaultSidePanelOpen?: boolean;
}

/**
 * Two-region content-focus layout (spec `contracts/content-focus-view.md`): preview on the
 * left, a collapsible side panel (existing entity-item attributes/relations) on the right at
 * `1fr / 360px`. Fills the available height with no nested scrollbars (FR-015) — each region
 * owns its own `overflow`/`min-h-0` so only that region scrolls, never the page. Stacks
 * vertically below 800px. Forwards `ref` to the outer element so a caller can request
 * fullscreen on the whole layout (FR-011).
 */
export const ContentFocusLayout = forwardRef<HTMLDivElement, ContentFocusLayoutProps>(
  function ContentFocusLayout(
    { preview, sidePanel, sidePanelTitle = "Details", defaultSidePanelOpen = true },
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
        <div className="min-h-0 min-w-0 overflow-hidden">{preview}</div>
        <div
          className={[
            "flex min-h-0 flex-col overflow-hidden rounded-lg border",
            open ? "" : "min-[800px]:w-12",
          ].join(" ")}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            {open && <span className="truncate text-sm font-semibold">{sidePanelTitle}</span>}
            <Button
              type="button"
              variant="ghost"
              size="icon"
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
