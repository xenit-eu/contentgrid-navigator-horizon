import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { PdfErrorCode, ignore } from "@embedpdf/models";
import { useDocumentManagerCapability } from "@embedpdf/plugin-document-manager/react";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import type { ZoomLevel } from "@embedpdf/plugin-zoom";
import { useZoom } from "@embedpdf/plugin-zoom/react";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PdfDocumentPhase = "idle" | "opening" | "ready" | "protected" | "invalid";

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
// Document lifecycle — safe to call unconditionally
// ---------------------------------------------------------------------------

export interface UseDocumentLifecycleOptions {
  /** The document bytes to display; a new reference (re)opens the document. */
  bytes: ArrayBuffer;
  /** Used as the document's display name inside the engine (not a URL). */
  filename: string;
}

export interface DocumentLifecycleState {
  readonly documentId: string | null;
  readonly documentState: PdfDocumentPhase;
}

/**
 * Opens/closes the document as `bytes` changes and derives the document's
 * phase. Deliberately does **not** touch the scroll or zoom plugins: both
 * throw ("Zoom state not found for document: ...") when queried for a
 * document id that was never registered, so — unlike `useDocumentState`,
 * which is documented to accept `null` — they must only ever be called with
 * a real, already-open document id. `usePdfViewerActiveState` below is the
 * half of this hook that is safe to call only once `documentId` is known;
 * `pdf-viewer.tsx` mounts the component that calls it conditionally on that.
 */
export function useDocumentLifecycle({
  bytes,
  filename,
}: UseDocumentLifecycleOptions): DocumentLifecycleState {
  const { provides: documentManager } = useDocumentManagerCapability();
  const [documentId, setDocumentId] = useState<string | null>(null);
  // "opening" is set the moment `openDocumentBuffer` is called, not only
  // once a document id comes back — the open call itself can take a beat.
  const [localPhase, setLocalPhase] = useState<"idle" | "opening" | "invalid" | "protected">(
    "idle",
  );

  const rawDocumentState = useDocumentState(documentId);

  // -----------------------------------------------------------------------
  // Open the document whenever `bytes` (re)opens; close-after-open guard
  // (upstream #754: closing a still-loading document leaks). A document is
  // only ever closed once we actually hold its id — either by this effect's
  // own cleanup, or, if the id only becomes known after the effect was
  // already cleaned up (React Strict-Mode double-invoke, or `bytes`
  // changing again before the previous open settled), by the success
  // callback itself noticing it is stale and closing what it just opened.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!documentManager) {
      setLocalPhase("idle");
      return;
    }

    let cancelled = false;
    let openedDocumentId: string | null = null;

    setDocumentId(null);
    setLocalPhase("opening");

    const openTask = documentManager.openDocumentBuffer({ buffer: bytes, name: filename });
    openTask.wait(
      (response) => {
        if (cancelled) {
          documentManager.closeDocument(response.documentId);
          return;
        }
        openedDocumentId = response.documentId;
        setDocumentId(response.documentId);
      },
      (error) => {
        if (cancelled) return;
        setLocalPhase(error.reason.code === PdfErrorCode.Password ? "protected" : "invalid");
      },
    );

    return () => {
      cancelled = true;
      if (openedDocumentId) {
        documentManager.closeDocument(openedDocumentId).wait(ignore, ignore);
      }
    };
  }, [documentManager, bytes, filename]);

  const documentState: PdfDocumentPhase = useMemo(() => {
    if (localPhase === "invalid" || localPhase === "protected") return localPhase;
    if (!documentId) return localPhase;
    if (!rawDocumentState) return "opening";
    switch (rawDocumentState.status) {
      case "loading":
        return "opening";
      case "loaded":
        return "ready";
      case "error":
        return rawDocumentState.errorCode === PdfErrorCode.Password ? "protected" : "invalid";
      default:
        return "opening";
    }
  }, [localPhase, documentId, rawDocumentState]);

  return { documentId, documentState };
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
  readonly fullscreen: boolean;
  readonly actions: PdfViewerStateActions;
}

/**
 * Composes the scroll and zoom plugin hooks for one already-open document
 * into page/zoom/fullscreen state, plus the native-Fullscreen-API glue.
 *
 * Extension seam: this hook returns one named slice per concern
 * (`page`, `zoom`, `fullscreen`, `actions`). A future `search` (T035) or
 * `print` (T036) slice is additive — it does not require reshaping any of
 * the fields above.
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
  const page: PdfViewerPageState = useMemo(
    () => ({
      current: documentState === "ready" ? scrollState.currentPage : 0,
      total: documentState === "ready" ? scrollState.totalPages : 0,
    }),
    [documentState, scrollState.currentPage, scrollState.totalPages],
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

  return {
    page,
    zoom: zoomView,
    fullscreen,
    actions: {
      goToPage,
      previousPage,
      nextPage,
      zoomIn,
      zoomOut,
      setZoom,
      toggleFullscreen,
    },
  };
}
