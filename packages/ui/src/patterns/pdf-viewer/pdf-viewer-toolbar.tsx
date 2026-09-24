import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowsInIcon,
  ArrowsOutIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DownloadIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PrinterIcon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { Input } from "../../primitives/input";
import { TooltipProvider } from "../../primitives/tooltip";
import { IconButton } from "./pdf-viewer-icon-button";
import { type PdfViewerLabels, formatLabel } from "./pdf-viewer-labels";
import { PdfViewerSearchPopover } from "./pdf-viewer-search-popover";
import type { PdfViewerSearchActions, PdfViewerSearchState } from "./use-pdf-viewer-search";
import type {
  PdfDocumentPhase,
  PdfViewerPageState,
  PdfViewerStateActions,
  PdfViewerZoomState,
} from "./use-pdf-viewer-state";

/** Zoom presets shown in the zoom menu, as percentages (100 = 100%). */
const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 300, 400] as const;

export interface PdfViewerToolbarProps {
  /** Slot rendered before page navigation (a feature puts an attribute selector here). */
  readonly start?: ReactNode;
  /** Slot rendered after the built-in actions. */
  readonly end?: ReactNode;
  readonly showPageNavigation: boolean;
  readonly showZoom: boolean;
  readonly showSearch: boolean;
  readonly showPrint: boolean;
  readonly showFullscreen: boolean;
  readonly onDownload?: () => void;
  readonly documentState: PdfDocumentPhase;
  readonly page: PdfViewerPageState;
  readonly zoom: PdfViewerZoomState;
  readonly search: PdfViewerSearchState;
  readonly fullscreen: boolean;
  readonly actions: PdfViewerStateActions;
  readonly searchActions: PdfViewerSearchActions;
  readonly labels: PdfViewerLabels;
  readonly className?: string;
}

function PageNavigation({
  page,
  ready,
  actions,
  labels,
}: Readonly<{
  page: PdfViewerPageState;
  ready: boolean;
  actions: PdfViewerStateActions;
  labels: PdfViewerLabels;
}>) {
  const [inputValue, setInputValue] = useState(String(page.current));

  useEffect(() => {
    setInputValue(String(page.current));
  }, [page.current]);

  function commitJump() {
    const target = Number.parseInt(inputValue, 10);
    if (Number.isFinite(target)) {
      actions.goToPage(target);
    } else {
      setInputValue(String(page.current));
    }
  }

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={labels.previousPage}
        disabled={!ready || page.current <= 1}
        onClick={actions.previousPage}
      >
        <CaretLeftIcon />
      </IconButton>
      <Input
        aria-label={labels.pageNumberInput}
        className="h-8 w-12 px-1 text-center"
        inputMode="numeric"
        disabled={!ready}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value.replace(/\D/g, ""))}
        onBlur={commitJump}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitJump();
          }
        }}
      />
      <span className="text-muted-foreground text-sm whitespace-nowrap" aria-hidden>
        {labels.pageCountSeparator} {page.total}
      </span>
      <IconButton
        label={labels.nextPage}
        disabled={!ready || page.current >= page.total}
        onClick={actions.nextPage}
      >
        <CaretRightIcon />
      </IconButton>
    </div>
  );
}

function ZoomControls({
  zoom,
  ready,
  actions,
  labels,
}: Readonly<{
  zoom: PdfViewerZoomState;
  ready: boolean;
  actions: PdfViewerStateActions;
  labels: PdfViewerLabels;
}>) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label={labels.zoomOut} disabled={!ready} onClick={actions.zoomOut}>
        <MagnifyingGlassMinusIcon />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!ready}
            aria-label={labels.zoomLevel}
            className="w-16 tabular-nums"
          >
            {zoom.level}%
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset} onSelect={() => actions.setZoom(preset)}>
              {preset}%
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => actions.setZoom("fit-width")}>
            {labels.zoomMenuFitWidth}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.setZoom("fit-page")}>
            {labels.zoomMenuFitPage}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label={labels.zoomIn} disabled={!ready} onClick={actions.zoomIn}>
        <MagnifyingGlassPlusIcon />
      </IconButton>
    </div>
  );
}

export function PdfViewerToolbar({
  start,
  end,
  showPageNavigation,
  showZoom,
  showSearch,
  showPrint,
  showFullscreen,
  onDownload,
  documentState,
  page,
  zoom,
  search,
  fullscreen,
  actions,
  searchActions,
  labels,
  className,
}: Readonly<PdfViewerToolbarProps>) {
  const ready = documentState === "ready";

  // Announce the latest of a page, zoom or search change through one shared
  // live region — whichever changed most recently is what gets announced.
  const [announcement, setAnnouncement] = useState("");
  const previousPage = useRef(page.current);
  const previousZoom = useRef(zoom.level);
  const previousSearch = useRef(`${search.total}:${search.activeIndex}`);

  useEffect(() => {
    if (!ready || page.current === previousPage.current) return;
    previousPage.current = page.current;
    setAnnouncement(
      formatLabel(labels.pageAnnouncement, { current: page.current, total: page.total }),
    );
  }, [ready, page.current, page.total, labels.pageAnnouncement]);

  useEffect(() => {
    if (!ready || zoom.level === previousZoom.current) return;
    previousZoom.current = zoom.level;
    setAnnouncement(formatLabel(labels.zoomAnnouncement, { percent: zoom.level }));
  }, [ready, zoom.level, labels.zoomAnnouncement]);

  useEffect(() => {
    const key = `${search.total}:${search.activeIndex}`;
    if (!ready || key === previousSearch.current) return;
    previousSearch.current = key;
    if (search.total > 0) {
      setAnnouncement(
        formatLabel(labels.searchAnnouncement, {
          index: search.activeIndex + 1,
          total: search.total,
        }),
      );
    } else if (search.query) {
      setAnnouncement(labels.searchNoResults);
    }
  }, [
    ready,
    search.total,
    search.activeIndex,
    search.query,
    labels.searchAnnouncement,
    labels.searchNoResults,
  ]);

  return (
    <TooltipProvider>
      <div className={cn("bg-background flex items-center gap-2 border-b px-2 py-1.5", className)}>
        {start}
        {showPageNavigation && (
          <PageNavigation page={page} ready={ready} actions={actions} labels={labels} />
        )}
        {showZoom && <ZoomControls zoom={zoom} ready={ready} actions={actions} labels={labels} />}
        <div className="flex-1" />
        {showSearch && (
          <PdfViewerSearchPopover
            search={search}
            searchActions={searchActions}
            ready={ready}
            labels={labels}
          />
        )}
        {showPrint && (
          <IconButton label={labels.print} disabled={!ready} onClick={actions.print}>
            <PrinterIcon />
          </IconButton>
        )}
        {onDownload && (
          <IconButton label={labels.download} disabled={!ready} onClick={onDownload}>
            <DownloadIcon />
          </IconButton>
        )}
        {showFullscreen && (
          <IconButton
            label={fullscreen ? labels.exitFullscreen : labels.enterFullscreen}
            disabled={!ready}
            onClick={actions.toggleFullscreen}
          >
            {fullscreen ? <ArrowsInIcon /> : <ArrowsOutIcon />}
          </IconButton>
        )}
        {end}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </TooltipProvider>
  );
}
