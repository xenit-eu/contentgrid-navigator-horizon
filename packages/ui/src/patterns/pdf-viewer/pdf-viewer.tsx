import { Component, type ReactNode, type RefObject, useEffect, useMemo, useRef } from "react";
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

function PdfViewerStatusMessage({
  documentState,
  labels,
}: Readonly<{ documentState: PdfDocumentPhase; labels: PdfViewerLabels }>) {
  if (documentState === "ready") return null;
  const message =
    documentState === "protected"
      ? labels.protectedDocument
      : documentState === "invalid"
        ? labels.invalidDocument
        : documentState === "opening"
          ? labels.openingDocument
          : null;
  if (!message) return null;
  return (
    <div className="text-muted-foreground flex h-full w-full items-center justify-center p-8 text-center text-sm">
      {message}
    </div>
  );
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
      <div className="relative min-h-0 flex-1">
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
        <div className="text-muted-foreground flex h-full w-full items-center justify-center p-8 text-center text-sm">
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
