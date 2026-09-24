/**
 * All user-visible strings the `PdfViewer` pattern renders. Every field is a
 * plain string (never a component or a React node) so a caller can supply a
 * translated set wholesale. `pageAnnouncement` and `zoomAnnouncement` are
 * templates interpolated with `formatLabel` — the only placeholders they
 * support are the ones documented on each field.
 */
export interface PdfViewerLabels {
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageNumberInput: string;
  readonly pageCountSeparator: string;
  readonly zoomOut: string;
  readonly zoomIn: string;
  readonly zoomLevel: string;
  readonly zoomMenuFitWidth: string;
  readonly zoomMenuFitPage: string;
  readonly download: string;
  readonly enterFullscreen: string;
  readonly exitFullscreen: string;
  readonly openingDocument: string;
  readonly protectedDocument: string;
  readonly invalidDocument: string;
  readonly engineError: string;
  /** Template with `{current}` and `{total}` placeholders. */
  readonly pageAnnouncement: string;
  /** Template with a `{percent}` placeholder. */
  readonly zoomAnnouncement: string;
  /** Opens the search popover; also its accessible name. */
  readonly search: string;
  readonly searchInputLabel: string;
  readonly searchPreviousMatch: string;
  readonly searchNextMatch: string;
  readonly searchMatchCase: string;
  readonly searchWholeWord: string;
  readonly searchClear: string;
  readonly searchNoResults: string;
  /** Template with `{index}` and `{total}` placeholders — the visible "n of m" indicator. */
  readonly searchResultTemplate: string;
  /** Template with `{index}` and `{total}` placeholders, announced through the live region. */
  readonly searchAnnouncement: string;
  readonly print: string;
}

export const DEFAULT_PDF_VIEWER_LABELS: PdfViewerLabels = {
  previousPage: "Previous page",
  nextPage: "Next page",
  pageNumberInput: "Current page",
  pageCountSeparator: "/",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  zoomLevel: "Zoom level",
  zoomMenuFitWidth: "Fit width",
  zoomMenuFitPage: "Fit page",
  download: "Download",
  enterFullscreen: "Enter fullscreen",
  exitFullscreen: "Exit fullscreen",
  openingDocument: "Opening document…",
  protectedDocument: "This document is password protected.",
  invalidDocument: "This document could not be opened.",
  engineError: "The PDF viewer failed to start.",
  pageAnnouncement: "Page {current} of {total}",
  zoomAnnouncement: "Zoom {percent}%",
  search: "Search",
  searchInputLabel: "Search in document",
  searchPreviousMatch: "Previous match",
  searchNextMatch: "Next match",
  searchMatchCase: "Match case",
  searchWholeWord: "Whole word",
  searchClear: "Clear search",
  searchNoResults: "No matches found",
  searchResultTemplate: "{index} of {total}",
  searchAnnouncement: "Match {index} of {total}",
  print: "Print",
};

/** Replaces `{key}` placeholders in `template` with `values[key]`. */
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
