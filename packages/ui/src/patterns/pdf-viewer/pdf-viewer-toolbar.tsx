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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";
import { DEFAULT_PDF_VIEWER_LABELS, type PdfViewerLabels, formatLabel } from "./pdf-viewer-labels";
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
  readonly showFullscreen: boolean;
  readonly onDownload?: () => void;
  readonly documentState: PdfDocumentPhase;
  readonly page: PdfViewerPageState;
  readonly zoom: PdfViewerZoomState;
  readonly fullscreen: boolean;
  readonly actions: PdfViewerStateActions;
  readonly labels: PdfViewerLabels;
  readonly className?: string;
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
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
        onChange={(event) => setInputValue(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commitJump}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitJump();
          }
        }}
      />
      <span className="text-muted-foreground text-sm" aria-hidden>
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
  showFullscreen,
  onDownload,
  documentState,
  page,
  zoom,
  fullscreen,
  actions,
  labels,
  className,
}: Readonly<PdfViewerToolbarProps>) {
  const ready = documentState === "ready";

  // Announce the latest of a page or a zoom change through one shared
  // live region — whichever changed most recently is what gets announced.
  const [announcement, setAnnouncement] = useState("");
  const previousPage = useRef(page.current);
  const previousZoom = useRef(zoom.level);

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

  return (
    <TooltipProvider>
      <div className={cn("bg-background flex items-center gap-2 border-b px-2 py-1.5", className)}>
        {start}
        {showPageNavigation && (
          <PageNavigation page={page} ready={ready} actions={actions} labels={labels} />
        )}
        {showZoom && <ZoomControls zoom={zoom} ready={ready} actions={actions} labels={labels} />}
        {/* Search and print controls join here (US3, T035/T036) — this flex
            row and the shared `actions`/`labels` shapes already accommodate
            them without restructuring. */}
        <div className="flex-1" />
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

export { DEFAULT_PDF_VIEWER_LABELS };
export type { PdfViewerLabels };
