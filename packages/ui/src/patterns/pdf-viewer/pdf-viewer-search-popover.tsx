import { CaretDownIcon, CaretUpIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { Switch } from "../../primitives/switch";
import { IconButton } from "./pdf-viewer-icon-button";
import { type PdfViewerLabels, formatLabel } from "./pdf-viewer-labels";
import type { PdfViewerSearchActions, PdfViewerSearchState } from "./use-pdf-viewer-search";

export interface PdfViewerSearchPopoverProps {
  readonly search: PdfViewerSearchState;
  readonly searchActions: PdfViewerSearchActions;
  readonly ready: boolean;
  readonly labels: PdfViewerLabels;
}

/**
 * The toolbar's search control (T035): a popover with the query input, the
 * "n of m" indicator, previous/next-match, clear, and the match-case/
 * whole-word toggles. Split out of `pdf-viewer-toolbar.tsx` into its own
 * file — a self-contained control with a clean `search`/`searchActions`
 * props boundary and no dependency on the rest of the toolbar beyond the
 * shared `IconButton` (`pdf-viewer-icon-button.tsx`).
 *
 * The popover's content renders through a Radix `Portal` into
 * `document.body`, not into a story's `canvasElement` — a `play()` querying
 * it must use `within(document.body)` (see `pdf-viewer.interaction.stories.tsx`).
 * Must be rendered inside a `TooltipProvider` (for its `IconButton`s) — the
 * toolbar wraps its whole render tree in one.
 */
export function PdfViewerSearchPopover({
  search,
  searchActions,
  ready,
  labels,
}: Readonly<PdfViewerSearchPopoverProps>) {
  const hasQuery = search.query.length > 0;
  const hasResults = search.total > 0;
  const positionLabel = hasResults
    ? formatLabel(labels.searchResultTemplate, {
        index: search.activeIndex + 1,
        total: search.total,
      })
    : hasQuery
      ? labels.searchNoResults
      : null;

  return (
    <Popover open={search.open} onOpenChange={searchActions.setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={labels.search}
          disabled={!ready}
        >
          <MagnifyingGlassIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <Input
            aria-label={labels.searchInputLabel}
            placeholder={labels.search}
            value={search.query}
            onChange={(event) => searchActions.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (event.shiftKey) {
                searchActions.previousMatch();
              } else {
                searchActions.nextMatch();
              }
            }}
            className="h-8"
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs" aria-hidden>
              {positionLabel ?? ""}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                label={labels.searchPreviousMatch}
                disabled={!hasResults}
                onClick={searchActions.previousMatch}
              >
                <CaretUpIcon />
              </IconButton>
              <IconButton
                label={labels.searchNextMatch}
                disabled={!hasResults}
                onClick={searchActions.nextMatch}
              >
                <CaretDownIcon />
              </IconButton>
              <IconButton
                label={labels.searchClear}
                disabled={!hasQuery}
                onClick={searchActions.clearSearch}
              >
                <XIcon />
              </IconButton>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                aria-label={labels.searchMatchCase}
                checked={search.matchCase}
                onCheckedChange={searchActions.toggleMatchCase}
              />
              {labels.searchMatchCase}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                aria-label={labels.searchWholeWord}
                checked={search.wholeWord}
                onCheckedChange={searchActions.toggleWholeWord}
              />
              {labels.searchWholeWord}
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
