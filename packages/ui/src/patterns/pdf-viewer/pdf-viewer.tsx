import {
  Component,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF } from "@embedpdf/core/react";
import type { PluginBatchRegistrations } from "@embedpdf/core/react";
import { DocumentManagerPluginPackage } from "@embedpdf/plugin-document-manager/react";
import {
  GlobalPointerProvider,
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import { PrintPluginPackage } from "@embedpdf/plugin-print/react";
import { RenderLayer, RenderPluginPackage } from "@embedpdf/plugin-render/react";
import { ScrollPluginPackage, ScrollStrategy, Scroller } from "@embedpdf/plugin-scroll/react";
import { SearchLayer, SearchPluginPackage } from "@embedpdf/plugin-search/react";
import { SelectionLayer, SelectionPluginPackage } from "@embedpdf/plugin-selection/react";
import { Viewport, ViewportPluginPackage } from "@embedpdf/plugin-viewport/react";
import { ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";
import { cn } from "../../lib/utils";
import {
  PdfEngineProvider,
  type PdfEngineStatus,
  useAmbientPdfEngineStatus,
} from "./pdf-engine-provider";
import { DEFAULT_PDF_VIEWER_LABELS, type PdfViewerLabels } from "./pdf-viewer-labels";
import { PdfViewerToolbar } from "./pdf-viewer-toolbar";
import {
  NOOP_ACTIONS,
  NOOP_SEARCH_ACTIONS,
  type PdfDocumentPhase,
  type PdfViewerPageState,
  type PdfViewerSearchActions,
  type PdfViewerSearchState,
  type PdfViewerStateActions,
  type PdfViewerZoomState,
  type PdfZoomInput,
  ZERO_PAGE,
  ZERO_SEARCH,
  ZERO_ZOOM,
  useDocumentLifecycle,
  usePdfViewerActiveState,
  zoomInputToLevel,
} from "./use-pdf-viewer-state";

// ---------------------------------------------------------------------------
// Public contract (specs/002-pdf-viewer/contracts/pdf-viewer-pattern.md)
// ---------------------------------------------------------------------------

export interface PdfViewerToolbarOptions {
  /** Slot before page navigation (a feature puts an attribute selector here). */
  readonly start?: ReactNode;
  readonly pageNavigation?: boolean;
  readonly zoom?: boolean;
  readonly search?: boolean;
  readonly print?: boolean;
  readonly fullscreen?: boolean;
  /** Slot after the built-in actions. */
  readonly end?: ReactNode;
}

export type PdfLoadError = { readonly kind: "invalid" | "protected" | "engine" };

export interface PdfViewerProps {
  /** The document; a new reference reopens the document. */
  readonly bytes: ArrayBuffer;
  /** Used for the print title and download label. */
  readonly filename: string;
  /** Absolute URL of the self-hosted `pdfium.wasm` binary. */
  readonly wasmUrl: string;
  readonly toolbar?: PdfViewerToolbarOptions | false;
  readonly initialZoom?: PdfZoomInput;
  /** Download button; absent hides the button. */
  readonly onDownload?: () => void;
  readonly onDocumentOpened?: (info: { pageCount: number }) => void;
  readonly onLoadError?: (error: PdfLoadError) => void;
  /** Element the native Fullscreen API toggles. Defaults to the viewer root. */
  readonly fullscreenTarget?: RefObject<HTMLElement | null>;
  readonly labels?: Partial<PdfViewerLabels>;
  readonly className?: string;
}

export type { PdfViewerLabels };

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

export interface PdfViewerErrorBoundaryProps {
  readonly fallback: (error: Error, reset: () => void) => ReactNode;
  readonly children: ReactNode;
}

interface PdfViewerErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Catches an exception thrown by the engine or a plugin during render (FR-025).
 * A caller wraps `<PdfViewer>` with this — it is not applied internally, so a
 * host can compose its own recovery UI around the whole viewer subtree.
 */
export class PdfViewerErrorBoundary extends Component<
  PdfViewerErrorBoundaryProps,
  PdfViewerErrorBoundaryState
> {
  state: PdfViewerErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PdfViewerErrorBoundaryState {
    return { error };
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Plugin registration (composed once per mounted viewer)
// ---------------------------------------------------------------------------

function usePdfViewerPlugins(initialZoom: PdfZoomInput): PluginBatchRegistrations {
  // `initialZoom` only seeds the zoom plugin's default; like an uncontrolled
  // input's `defaultValue`, later changes to the prop do not re-register
  // plugins (that would remount the whole EmbedPDF tree).
  const initialZoomRef = useRef(initialZoom);

  return useMemo<PluginBatchRegistrations>(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage, {
        defaultStrategy: ScrollStrategy.Vertical,
      }),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: zoomInputToLevel(initialZoomRef.current),
      }),
      createPluginRegistration(SearchPluginPackage),
      createPluginRegistration(PrintPluginPackage),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
    ],
    [],
  );
}

// ---------------------------------------------------------------------------
// Status message shown in the content area for every non-"ready" state
// ---------------------------------------------------------------------------

/**
 * `aria-busy` is `true` for `idle`/`opening` (still loading — nothing to show
 * yet, or the document is being parsed) and `false` for `protected`/`invalid`
 * (a terminal, resolved state — the message itself IS the result, not a sign
 * more is coming). Rendered even for `idle` (no message text) so the busy
 * signal exists from the very first paint, not only once the "opening"
 * message text appears a tick later. `ready` renders nothing here — the real
 * content takes over (see `PdfViewerChrome`'s content-area `aria-busy`,
 * which picks up the busy signal from `ready` through first paint).
 */
// Maps each terminal/loading phase to its label field; `idle`/`ready` have
// no message of their own (looked up as `undefined` below -> no text).
const STATUS_MESSAGE_KEY: Partial<Record<PdfDocumentPhase, keyof PdfViewerLabels>> = {
  protected: "protectedDocument",
  invalid: "invalidDocument",
  opening: "openingDocument",
};

export function PdfViewerStatusMessage({
  documentState,
  labels,
}: Readonly<{ documentState: PdfDocumentPhase; labels: PdfViewerLabels }>) {
  if (documentState === "ready") return null;
  const key = STATUS_MESSAGE_KEY[documentState];
  const message = key ? labels[key] : null;
  return (
    <div
      aria-busy={documentState === "idle" || documentState === "opening"}
      className="text-muted-foreground flex h-full w-full items-center justify-center p-8 text-center text-sm"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// First-page paint signal — `RenderLayer` (`@embedpdf/plugin-render`) renders
// each page's bitmap asynchronously with no completion event, so
// `documentState === "ready"` only means the *document* parsed; the first
// page's pixels can still be a beat away, and that gap is indistinguishable
// from "never started" to a screenshot-stability check (the actual cause of
// blank-content-area visual baselines). This hook watches the content-area
// element (`PdfViewerChrome`'s own div, via `contentRef`) for an `<img>`
// anywhere in its subtree, not a ref on `RenderLayer`'s own per-page output —
// `Scroller` only decides which pages to render after its own layout pass,
// at least one render behind `documentState` reaching `"ready"`, so a ref
// scoped that low would still be `null` when this hook's effect first runs.
//
// A single "first image loaded" check is not enough: `@embedpdf/plugin-zoom`
// recalculates scale on load AND again, debounced 150ms, once the viewport
// reports its size (every "fit-width"/"fit-page"/"automatic" zoom mode —
// `initialZoom`'s default). Each recalculation swaps the same `<img>`'s
// `src` and, in `RenderLayer`'s own effect cleanup, revokes the *previous*
// blob: URL. If that revoke lands before the image mid-decode has actually
// decoded, the browser reports it as loaded (`complete: true`) but broken
// (`naturalWidth: 0`) — a real production bug this hook must not mistake for
// "painted". So the settle check below re-queries the DOM at fire time
// (never trusts a captured reference) and requires `complete && naturalWidth
// > 0`, re-arming on `load` *and* `error` for every image/src change.
//
// A generous outer timeout clears the signal regardless, so a genuine render
// failure degrades to a visibly-blank area rather than leaving `aria-busy`
// stuck forever for real assistive tech. It's deliberately longer than the
// visual harness's own `async-content` wait (30s, `visual.spec.ts`) so a
// genuine stall fails that wait loudly instead of this hook silently masking
// it by declaring "painted" first; only a run hung a full minute falls back
// to this.
// ---------------------------------------------------------------------------

export const FIRST_PAGE_PAINT_TIMEOUT_MS = 60_000;
const PAINT_SETTLE_MS = 400;

export function useFirstPagePainted(active: boolean): {
  readonly painted: boolean;
  readonly contentRef: RefObject<HTMLDivElement | null>;
} {
  const [painted, setPainted] = useState(false);
  // Attached to `PdfViewerChrome`'s content-area div — see the doc comment
  // above for why it must be that stable element, not a ref on a page's own
  // (later, conditionally-mounted) `RenderLayer` output.
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || painted) return;

    const container = contentRef.current;
    let disposed = false;
    let settleTimeoutId: number | undefined;
    let currentImg: HTMLImageElement | null = null;
    let removeImgListeners: (() => void) | undefined;

    const clearSettleTimer = () => {
      if (settleTimeoutId !== undefined) {
        window.clearTimeout(settleTimeoutId);
        settleTimeoutId = undefined;
      }
    };

    // Re-armed by every relevant event (image inserted, its `src` swapped,
    // it loading, or it erroring); only fires this check once nothing has
    // happened for `PAINT_SETTLE_MS`. Re-queries the DOM rather than trusting
    // a captured reference: `complete` alone can't tell a real paint from a
    // broken image (see the doc comment above — a `src` swap can revoke the
    // blob: URL an in-flight decode was still using).
    const scheduleSettleCheck = () => {
      clearSettleTimer();
      settleTimeoutId = window.setTimeout(() => {
        if (disposed || !container) return;
        const img = container.querySelector("img");
        if (img?.complete && img.naturalWidth > 0) setPainted(true);
        // Missing, still loading, or broken/revoked — wait for the next
        // mutation/load/error event to reschedule; nothing to do here.
      }, PAINT_SETTLE_MS);
    };

    // Re-attaches `load`/`error` listeners only when the watched element
    // itself changes (never twice on the same node), but re-arms the settle
    // timer on EVERY call — including a `src` swap of the image already
    // being watched, which the `attributes`/`attributeFilter: ["src"]`
    // observer config below reports as its own mutation callback.
    const watchImage = (img: HTMLImageElement) => {
      if (img !== currentImg) {
        removeImgListeners?.();
        currentImg = img;
        const onSettleEvent = () => scheduleSettleCheck();
        img.addEventListener("load", onSettleEvent);
        img.addEventListener("error", onSettleEvent);
        removeImgListeners = () => {
          img.removeEventListener("load", onSettleEvent);
          img.removeEventListener("error", onSettleEvent);
        };
      }
      scheduleSettleCheck();
    };

    let observer: MutationObserver | undefined;
    if (container) {
      const checkForImage = () => {
        const img = container.querySelector("img");
        if (img) watchImage(img);
        else scheduleSettleCheck();
      };
      observer = new MutationObserver(checkForImage);
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
      checkForImage();
    }

    const timeoutId = window.setTimeout(() => setPainted(true), FIRST_PAGE_PAINT_TIMEOUT_MS);
    return () => {
      disposed = true;
      observer?.disconnect();
      removeImgListeners?.();
      clearSettleTimer();
      window.clearTimeout(timeoutId);
    };
  }, [active, painted]);

  return { painted, contentRef };
}

// ---------------------------------------------------------------------------
// Chrome — toolbar + content area, driven by already-resolved state. Shared
// by the "no document yet" path (inert page/zoom/actions) and the active
// session (real state from `usePdfViewerActiveState`) so there is exactly
// one place that lays the toolbar and viewport out.
// ---------------------------------------------------------------------------

interface PdfViewerChromeProps {
  readonly documentId: string | null;
  readonly documentState: PdfDocumentPhase;
  readonly page: PdfViewerPageState;
  readonly zoom: PdfViewerZoomState;
  readonly search: PdfViewerSearchState;
  readonly fullscreen: boolean;
  readonly actions: PdfViewerStateActions;
  readonly searchActions: PdfViewerSearchActions;
  readonly resolvedToolbar: PdfViewerToolbarOptions | false;
  readonly labels: PdfViewerLabels;
  readonly onDownload?: () => void;
}

function PdfViewerChrome({
  documentId,
  documentState,
  page,
  zoom,
  search,
  fullscreen,
  actions,
  searchActions,
  resolvedToolbar,
  labels,
  onDownload,
}: Readonly<PdfViewerChromeProps>) {
  // Only tracks paint while `ready` (see `useFirstPagePainted`'s own doc
  // comment) — mounted here rather than in `PdfViewerActiveSession` because
  // this component is what owns the content-area element `aria-busy` is set
  // on, and both the "ready" and "placeholder" render paths go through it.
  const { painted: firstPagePainted, contentRef } = useFirstPagePainted(documentState === "ready");

  return (
    <>
      {resolvedToolbar !== false && (
        <PdfViewerToolbar
          start={resolvedToolbar.start}
          end={resolvedToolbar.end}
          showPageNavigation={resolvedToolbar.pageNavigation ?? true}
          showZoom={resolvedToolbar.zoom ?? true}
          showSearch={resolvedToolbar.search ?? true}
          showPrint={resolvedToolbar.print ?? true}
          showFullscreen={resolvedToolbar.fullscreen ?? true}
          onDownload={onDownload}
          documentState={documentState}
          page={page}
          zoom={zoom}
          search={search}
          fullscreen={fullscreen}
          actions={actions}
          searchActions={searchActions}
          labels={labels}
        />
      )}
      {/* `aria-busy` here only ever covers the `ready`-but-unpainted gap —
          `idle`/`opening`/`protected`/`invalid` are covered by
          `PdfViewerStatusMessage`'s own `aria-busy` below, mutually
          exclusive with this branch (see its doc comment). Together these
          give the visual-regression harness (`visual.spec.ts`) a generic
          `[aria-busy="true"]` signal to wait out before it screenshots a story
          tagged `async-content` (ADR-009) — stories that load a real document
          through the PDFium/WASM engine opt in via that tag; a permanently-busy
          loading state must NOT carry it. */}
      <div
        ref={contentRef}
        className="relative min-h-0 flex-1"
        aria-busy={documentState === "ready" && !firstPagePainted}
      >
        {documentState === "ready" && documentId ? (
          <GlobalPointerProvider documentId={documentId}>
            <Viewport documentId={documentId} className="bg-muted h-full w-full overflow-auto">
              <Scroller
                documentId={documentId}
                renderPage={({ pageIndex }) => (
                  <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
                    <RenderLayer
                      documentId={documentId}
                      pageIndex={pageIndex}
                      style={{ pointerEvents: "none" }}
                    />
                    <SelectionLayer documentId={documentId} pageIndex={pageIndex} />
                    {/* Distinct from selection: yellow/amber match highlights vs.
                        the primitive's selection-color rects (SearchLayer's own
                        defaults — #FFFF00 all matches, #FFBF00 active match). */}
                    <SearchLayer documentId={documentId} pageIndex={pageIndex} />
                  </PagePointerProvider>
                )}
              />
            </Viewport>
          </GlobalPointerProvider>
        ) : (
          <PdfViewerStatusMessage documentState={documentState} labels={labels} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Active session — mounted ONLY once a document id exists. `useScroll` and
// `useZoom` throw ("Zoom state not found for document: ...") when queried
// for a document id that was never registered, so they must never be called
// with a placeholder/empty id — this component's very existence is the
// guarantee that `documentId` is real.
// ---------------------------------------------------------------------------

interface PdfViewerActiveSessionProps {
  readonly documentId: string;
  readonly documentState: PdfDocumentPhase;
  readonly fullscreenTarget: RefObject<HTMLElement | null>;
  readonly onDocumentOpened?: (info: { pageCount: number }) => void;
  readonly resolvedToolbar: PdfViewerToolbarOptions | false;
  readonly labels: PdfViewerLabels;
  readonly onDownload?: () => void;
}

function PdfViewerActiveSession({
  documentId,
  documentState,
  fullscreenTarget,
  onDocumentOpened,
  resolvedToolbar,
  labels,
  onDownload,
}: Readonly<PdfViewerActiveSessionProps>) {
  const { page, zoom, search, fullscreen, actions, searchActions } = usePdfViewerActiveState({
    documentId,
    documentState,
    fullscreenTarget,
    onDocumentOpened,
  });

  return (
    <PdfViewerChrome
      documentId={documentId}
      documentState={documentState}
      page={page}
      zoom={zoom}
      search={search}
      fullscreen={fullscreen}
      actions={actions}
      searchActions={searchActions}
      resolvedToolbar={resolvedToolbar}
      labels={labels}
      onDownload={onDownload}
    />
  );
}

// ---------------------------------------------------------------------------
// Body — mounted once the EmbedPDF plugin registry is ready
// ---------------------------------------------------------------------------

interface PdfViewerBodyProps extends Pick<
  PdfViewerProps,
  "bytes" | "filename" | "onDownload" | "onDocumentOpened" | "onLoadError" | "fullscreenTarget"
> {
  readonly resolvedToolbar: PdfViewerToolbarOptions | false;
  readonly labels: PdfViewerLabels;
  readonly hostRef: RefObject<HTMLDivElement | null>;
}

function PdfViewerBody({
  bytes,
  filename,
  onDownload,
  onDocumentOpened,
  onLoadError,
  fullscreenTarget,
  resolvedToolbar,
  labels,
  hostRef,
}: Readonly<PdfViewerBodyProps>) {
  const effectiveFullscreenTarget = fullscreenTarget ?? hostRef;
  const { documentId, documentState } = useDocumentLifecycle({ bytes, filename });

  const reportedFailureRef = useRef<PdfDocumentPhase | null>(null);
  useEffect(() => {
    if (documentState === "protected" || documentState === "invalid") {
      if (reportedFailureRef.current === documentState) return;
      reportedFailureRef.current = documentState;
      onLoadError?.({ kind: documentState });
    } else {
      reportedFailureRef.current = null;
    }
  }, [documentState, onLoadError]);

  if (!documentId) {
    return (
      <PdfViewerChrome
        documentId={null}
        documentState={documentState}
        page={ZERO_PAGE}
        zoom={ZERO_ZOOM}
        search={ZERO_SEARCH}
        fullscreen={false}
        actions={NOOP_ACTIONS}
        searchActions={NOOP_SEARCH_ACTIONS}
        resolvedToolbar={resolvedToolbar}
        labels={labels}
        onDownload={onDownload}
      />
    );
  }

  return (
    <PdfViewerActiveSession
      documentId={documentId}
      documentState={documentState}
      fullscreenTarget={effectiveFullscreenTarget}
      onDocumentOpened={onDocumentOpened}
      resolvedToolbar={resolvedToolbar}
      labels={labels}
      onDownload={onDownload}
    />
  );
}

// ---------------------------------------------------------------------------
// Engine-status dispatch — loading / error / ready
// ---------------------------------------------------------------------------

interface PdfViewerWithEngineProps extends Omit<PdfViewerProps, "wasmUrl"> {
  readonly engineStatus: PdfEngineStatus;
}

function PdfViewerWithEngine({
  engineStatus,
  bytes,
  filename,
  toolbar,
  initialZoom,
  onDownload,
  onDocumentOpened,
  onLoadError,
  fullscreenTarget,
  labels: labelOverrides,
  className,
}: Readonly<PdfViewerWithEngineProps>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labels = useMemo<PdfViewerLabels>(
    () => ({ ...DEFAULT_PDF_VIEWER_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const resolvedToolbar = toolbar ?? {};

  const reportedEngineErrorRef = useRef(false);
  useEffect(() => {
    if (engineStatus.status === "error" && !reportedEngineErrorRef.current) {
      reportedEngineErrorRef.current = true;
      onLoadError?.({ kind: "engine" });
    }
  }, [engineStatus.status, onLoadError]);

  const plugins = usePdfViewerPlugins(initialZoom ?? "fit-width");

  return (
    <div
      ref={hostRef}
      className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", className)}
    >
      {engineStatus.status === "ready" ? (
        <EmbedPDF engine={engineStatus.engine} plugins={plugins}>
          {({ pluginsReady }) =>
            pluginsReady ? (
              <PdfViewerBody
                bytes={bytes}
                filename={filename}
                onDownload={onDownload}
                onDocumentOpened={onDocumentOpened}
                onLoadError={onLoadError}
                fullscreenTarget={fullscreenTarget}
                resolvedToolbar={resolvedToolbar}
                labels={labels}
                hostRef={hostRef}
              />
            ) : (
              <PdfViewerStatusMessage documentState="opening" labels={labels} />
            )
          }
        </EmbedPDF>
      ) : (
        // `aria-busy` only while the engine is genuinely still loading — an
        // `"error"` status is terminal (the message IS the result), same
        // convention as `PdfViewerStatusMessage` below it in the tree.
        <div
          aria-busy={engineStatus.status === "loading"}
          className="text-muted-foreground flex h-full w-full items-center justify-center p-8 text-center text-sm"
        >
          {engineStatus.status === "error" ? labels.engineError : labels.openingDocument}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/** Reads the ambient engine (if any) after `PdfEngineProviderIfNeeded` created one. */
function PdfViewerFromAmbientEngine(props: Readonly<Omit<PdfViewerProps, "wasmUrl">>) {
  // Non-null: only rendered as a child of a `PdfEngineProvider` we just created.
  const engineStatus = useAmbientPdfEngineStatus()!;
  return <PdfViewerWithEngine {...props} engineStatus={engineStatus} />;
}

/**
 * Headless-EmbedPDF-based PDF viewer with a shadcn toolbar (page navigation,
 * zoom, download, fullscreen; text selection enabled). Takes plain values and
 * callbacks only — no fetching, no Navigator data types (spec-001
 * `ui-standalone` contract). See
 * `specs/002-pdf-viewer/contracts/pdf-viewer-pattern.md` for the full
 * behavioural contract.
 */
export function PdfViewer(props: Readonly<PdfViewerProps>) {
  const { wasmUrl, ...rest } = props;
  const ambientEngineStatus = useAmbientPdfEngineStatus();

  if (ambientEngineStatus !== undefined) {
    return <PdfViewerWithEngine {...rest} engineStatus={ambientEngineStatus} />;
  }

  return (
    <PdfEngineProvider wasmUrl={wasmUrl}>
      <PdfViewerFromAmbientEngine {...rest} />
    </PdfEngineProvider>
  );
}
