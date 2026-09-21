import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { ignore } from "@embedpdf/models";
import { usePrint } from "@embedpdf/plugin-print/react";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import type { ZoomLevel } from "@embedpdf/plugin-zoom";
import { useZoom } from "@embedpdf/plugin-zoom/react";
import type { PdfDocumentPhase } from "./use-pdf-viewer-document-lifecycle";
import { useDocumentSearchState } from "./use-pdf-viewer-search";
import type { PdfViewerSearchActions, PdfViewerSearchState } from "./use-pdf-viewer-search";

export {
  useDocumentLifecycle,
  type PdfDocumentPhase,
  type DocumentLifecycleState,
  type UseDocumentLifecycleOptions,
} from "./use-pdf-viewer-document-lifecycle";
export {
  ZERO_SEARCH,
  NOOP_SEARCH_ACTIONS,
  type PdfViewerSearchState,
  type PdfViewerSearchActions,
} from "./use-pdf-viewer-search";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PdfZoomMode = "fit-width" | "fit-page" | "custom";

/** A zoom level as exposed to callers: a fit mode, or a plain percentage (100 = 100%). */
export type PdfZoomInput = "fit-width" | "fit-page" | number;

export interface PdfViewerPageState {
  /** 1-based current page, meaningful only once `documentState === "ready"`. */
  readonly current: number;
  readonly total: number;
}

export interface PdfViewerZoomState {
  readonly mode: PdfZoomMode;
  /** Zoom percentage (100 = 100%), rounded for display. */
  readonly level: number;
}

export interface PdfViewerStateActions {
  goToPage: (page: number) => void;
  previousPage: () => void;
  nextPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (level: PdfZoomInput) => void;
  toggleFullscreen: () => void;
  /** Prints the displayed document (all pages) via the print plugin's hidden frame. */
  print: () => void;
}

/** The `page`/`zoom`/`fullscreen` triple with no document open: every control reads as inert. */
export const ZERO_PAGE: PdfViewerPageState = { current: 0, total: 0 };
export const ZERO_ZOOM: PdfViewerZoomState = { mode: "fit-width", level: 0 };
export const NOOP_ACTIONS: PdfViewerStateActions = {
  goToPage: () => {},
  previousPage: () => {},
  nextPage: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  setZoom: () => {},
  toggleFullscreen: () => {},
  print: () => {},
};

// ---------------------------------------------------------------------------
// Zoom percentage <-> embedpdf ZoomLevel mapping
// ---------------------------------------------------------------------------

export function zoomInputToLevel(input: PdfZoomInput): ZoomLevel {
  if (input === "fit-width") return ZoomMode.FitWidth;
  if (input === "fit-page") return ZoomMode.FitPage;
  return input / 100;
}

function zoomLevelToMode(level: ZoomLevel): PdfZoomMode {
  if (level === ZoomMode.FitWidth) return "fit-width";
  if (level === ZoomMode.FitPage) return "fit-page";
  return "custom";
}

// ---------------------------------------------------------------------------
// Active-session state — only call once `documentId` is a real, open id
// ---------------------------------------------------------------------------

export interface UsePdfViewerActiveStateOptions {
  readonly documentId: string;
  readonly documentState: PdfDocumentPhase;
  /** Element the native Fullscreen API toggles. Falls back to `document.documentElement`. */
  fullscreenTarget?: RefObject<HTMLElement | null>;
  /** Fired once, the first time the current document finishes opening. */
  onDocumentOpened?: (info: { pageCount: number }) => void;
}

export interface PdfViewerActiveState {
  readonly page: PdfViewerPageState;
  readonly zoom: PdfViewerZoomState;
  readonly search: PdfViewerSearchState;
  readonly fullscreen: boolean;
  readonly actions: PdfViewerStateActions;
  readonly searchActions: PdfViewerSearchActions;
}

/**
 * Composes the scroll, zoom and print plugin hooks for one already-open
 * document into page/zoom/fullscreen state (plus the native-Fullscreen-API
 * glue) and the `print()` action; delegates search to
 * `useDocumentSearchState` (`use-pdf-viewer-search.ts`) since it has a clean
 * input/output boundary of its own (`documentId` + the scroll scope in,
 * `search`/`searchActions` out).
 *
 * Extension seam: this hook returns one named slice per concern (`page`,
 * `zoom`, `search`, `fullscreen`, `actions`, `searchActions`) — `search`/
 * `searchActions` (T035) and `actions.print` (T036) were added additively,
 * with no reshaping of the fields above them.
 *
 * `usePrint` (unlike `useScroll`/`useZoom`) never throws for a document id
 * whose plugin-scoped state isn't initialized yet — it falls back to a
 * `null` result instead (verified against the compiled
 * `@embedpdf/plugin-print` `/react` source) — so no extra gating is needed
 * for it beyond the existing "only mounted once `documentId` is real" rule
 * this hook already relies on.
 */
export function usePdfViewerActiveState({
  documentId,
  documentState,
  fullscreenTarget,
  onDocumentOpened,
}: UsePdfViewerActiveStateOptions): PdfViewerActiveState {
  const rawDocumentState = useDocumentState(documentId);
  const { provides: scroll, state: scrollState } = useScroll(documentId);
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: print } = usePrint(documentId);
  const { search, searchActions } = useDocumentSearchState({ documentId, scroll });

  // Fire `onDocumentOpened` exactly once per document that reaches "ready".
  const announcedDocumentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (documentState !== "ready") return;
    if (announcedDocumentIdRef.current === documentId) return;
    announcedDocumentIdRef.current = documentId;
    const pageCount = rawDocumentState?.document?.pageCount ?? scrollState.totalPages;
    onDocumentOpened?.({ pageCount });
  }, [documentState, documentId, rawDocumentState, scrollState.totalPages, onDocumentOpened]);

  // Page state — mounted (meaningfully non-zero) only once ready (#691).
  // `total` prefers `rawDocumentState.document.pageCount` over `scrollState.totalPages`:
  // `useScroll`'s local `totalPages` is a one-time sync read taken when `documentId` is set
  // (before the async engine parse finishes), corrected only via `onPageChange`, which fires
  // solely on a *current*-page change — never on open, since every document starts on page 1.
  // `rawDocumentState.document.pageCount` has no such race: it is set atomically with
  // `status: "loaded"` in the same core reducer dispatch that `documentState === "ready"`
  // itself derives from.
  const page: PdfViewerPageState = useMemo(
    () => ({
      current: documentState === "ready" ? scrollState.currentPage : 0,
      total:
        documentState === "ready"
          ? (rawDocumentState?.document?.pageCount ?? scrollState.totalPages)
          : 0,
    }),
    [documentState, scrollState.currentPage, scrollState.totalPages, rawDocumentState],
  );

  const goToPage = useCallback(
    (target: number) => {
      if (!scroll || page.total <= 0) return;
      const clamped = Math.min(Math.max(target, 1), page.total);
      scroll.scrollToPage({ pageNumber: clamped });
    },
    [scroll, page.total],
  );
  const previousPage = useCallback(() => scroll?.scrollToPreviousPage(), [scroll]);
  const nextPage = useCallback(() => scroll?.scrollToNextPage(), [scroll]);

  const zoomView: PdfViewerZoomState = useMemo(
    () => ({
      mode: zoomLevelToMode(zoomState.zoomLevel),
      level: Math.round(zoomState.currentZoomLevel * 100),
    }),
    [zoomState.zoomLevel, zoomState.currentZoomLevel],
  );

  const setZoom = useCallback(
    (input: PdfZoomInput) => zoom?.requestZoom(zoomInputToLevel(input)),
    [zoom],
  );
  const zoomIn = useCallback(() => zoom?.zoomIn(), [zoom]);
  const zoomOut = useCallback(() => zoom?.zoomOut(), [zoom]);

  // Fullscreen — native Fullscreen API; zoom mode is preserved across
  // enter/exit by re-requesting the mode we captured just before toggling
  // (a fit-* mode recomputes its absolute scale from the post-transition
  // viewport size on its own; this guards against a stale metrics read
  // during the transition resetting the mode itself).
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const target = fullscreenTarget?.current ?? null;
    const handleChange = () => {
      setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === target);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [fullscreenTarget]);

  const toggleFullscreen = useCallback(() => {
    const target = fullscreenTarget?.current ?? document.documentElement;
    const preservedLevel = zoomState.zoomLevel;
    const restoreZoom = () => {
      zoom?.requestZoom(preservedLevel);
    };
    // The Fullscreen API can reject *or* throw synchronously (disabled by a
    // Permissions-Policy, not a real user gesture, ...) depending on the
    // browser and embedding context; guard both so a denial never surfaces
    // as an unhandled exception.
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().then(restoreZoom, ignore);
      } else {
        target.requestFullscreen().then(restoreZoom, ignore);
      }
    } catch {
      // Fullscreen not permitted in this context — no-op.
    }
  }, [fullscreenTarget, zoom, zoomState.zoomLevel]);

  const printAction = useCallback(() => {
    print?.print();
  }, [print]);

  return {
    page,
    zoom: zoomView,
    search,
    fullscreen,
    actions: {
      goToPage,
      previousPage,
      nextPage,
      zoomIn,
      zoomOut,
      setZoom,
      toggleFullscreen,
      print: printAction,
    },
    searchActions,
  };
}
