import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  type EntityItem,
  isPdfMimetype,
  toProblemDisplayModel,
  useContentPreview,
  useDownloadContent,
} from "@contentgrid/navigator-data";
import { Badge, PdfEngineProvider, PdfViewerErrorBoundary } from "@contentgrid/ui";
import type { PdfLoadError, PdfViewerToolbarOptions } from "@contentgrid/ui";
import { getContentAttributeMetadata } from "../util/content-attribute-metadata";
import type { ViewerLoadErrorKind } from "../util/derive-content-preview-state";
import { deriveContentPreviewState } from "../util/derive-content-preview-state";
import { pdfiumWasmUrl } from "../util/pdfium-wasm-url";
import { ContentPreviewFrame } from "./content-preview-frame";

/**
 * Lazy import of `@contentgrid/ui`'s `PdfViewer` — its dependency (the PDFium/WASM engine, ~4.4
 * MB) only loads when a stored/converted PDF is actually about to be shown, not on every
 * content-focus page mount (research.md §8.2 of spec 002-pdf-viewer). `React.lazy` requires a
 * default export, so the named export is remapped here.
 */
const LazyPdfViewer = lazy(() =>
  import("@contentgrid/ui").then((module) => ({ default: module.PdfViewer })),
);

const FALLBACK_FILENAME = "document.pdf";

/** `previewUnavailable`'s message names the actual file type instead of a generic "this file
 * type" whenever the mimetype is known (`PreviewSource.unavailable`/`.unsupported.mimetype`). */
function buildPreviewUnavailableMessage(mimetype: string | null | undefined): string {
  return mimetype
    ? `Preview isn't available for ${mimetype} files.`
    : "Preview isn't available for this file type.";
}

export interface ContentPreviewPanelProps {
  readonly entityItem: EntityItem;
  readonly attributeName: string;
  /**
   * Content to render in the mounted `PdfViewer`'s toolbar `start` slot — the view (per
   * `contracts/content-focus-view.md`'s "Components" section) passes its `ContentAttributeSelector`
   * here so the user can switch attributes without leaving the viewer's own toolbar. The panel
   * itself has no attribute-selection logic; it only forwards this node into the toolbar when the
   * viewer is actually mounted (`ready` state) — every other preview state has no viewer toolbar
   * to put it in, so this prop has no effect there.
   */
  readonly toolbarStart?: ReactNode;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Owns `useContentPreview` + `useDownloadContent` for one content attribute and renders the
 * matching `ContentPreviewFrame` state (data-model.md's "Content preview panel state", FR-024).
 * Lazy-loads `@contentgrid/ui`'s `PdfViewer` — wrapped in `PdfViewerErrorBoundary` (catches a
 * render-time exception → `viewerFailure`) and its own `PdfEngineProvider` (self-hosted
 * `wasmUrl`) — only once a displayable PDF (stored or converted) is available.
 */
export function ContentPreviewPanel({
  entityItem,
  attributeName,
  toolbarStart,
}: Readonly<ContentPreviewPanelProps>) {
  const query = useContentPreview(entityItem, attributeName);
  const downloadMutation = useDownloadContent(entityItem, attributeName);
  const [viewerLoadErrorKind, setViewerLoadErrorKind] = useState<ViewerLoadErrorKind | null>(null);
  // Bumped on every Retry so the viewer/engine subtree's `key` changes, forcing a full remount —
  // an "engine" load error (`PdfEngineProvider`) needs a fresh engine attempt, not just a
  // re-render with the same `bytes`, which retrying otherwise would not produce.
  const [retryToken, setRetryToken] = useState(0);

  // A new attribute/item (or a re-upload bumping the ETag) means nothing from the previous
  // selection should keep showing as belonging to the new one (FR-006) — including a
  // viewer-reported load error from whatever was displayed before.
  useEffect(() => {
    setViewerLoadErrorKind(null);
  }, [entityItem, attributeName]);

  const metadata = getContentAttributeMetadata(entityItem, attributeName);
  const expectedOrigin =
    metadata === null || metadata === undefined
      ? null
      : isPdfMimetype(metadata.mimetype)
        ? "stored"
        : "rendition";

  const { state, problem, mimetype } = deriveContentPreviewState({
    queryStatus: query.status,
    previewSource: query.data,
    queryError: query.error,
    expectedOrigin,
    viewerLoadErrorKind,
  });

  function handleDownload(): void {
    downloadMutation.mutate(undefined, {
      onSuccess: (download) => {
        triggerDownload(
          download.blob,
          download.filename ?? metadata?.filename ?? FALLBACK_FILENAME,
        );
      },
    });
  }

  function handleRetry(): void {
    setViewerLoadErrorKind(null);
    setRetryToken((token) => token + 1);
    void query.refetch();
  }

  const canDownload = metadata !== null && metadata !== undefined;

  if (state === "ready" && query.data?.kind === "pdf") {
    const previewSource = query.data;
    const toolbar: PdfViewerToolbarOptions = {
      start: toolbarStart,
      end:
        previewSource.origin === "rendition" ? (
          <Badge variant="secondary">Converted preview</Badge>
        ) : undefined,
    };

    return (
      <ContentPreviewFrame state="ready">
        <PdfViewerErrorBoundary
          fallback={(error) => (
            <ContentPreviewFrame
              state="viewerFailure"
              problem={toProblemDisplayModel(error)}
              onDownload={handleDownload}
              onRetry={handleRetry}
            />
          )}
        >
          <PdfEngineProvider
            key={`${attributeName}:${entityItem.etag ?? ""}:${retryToken}`}
            wasmUrl={pdfiumWasmUrl}
          >
            <Suspense
              fallback={<ContentPreviewFrame state="loading" onDownload={handleDownload} />}
            >
              <LazyPdfViewer
                bytes={previewSource.bytes}
                filename={previewSource.filename}
                wasmUrl={pdfiumWasmUrl}
                toolbar={toolbar}
                onDownload={handleDownload}
                onLoadError={(error: PdfLoadError) => setViewerLoadErrorKind(error.kind)}
              />
            </Suspense>
          </PdfEngineProvider>
        </PdfViewerErrorBoundary>
      </ContentPreviewFrame>
    );
  }

  return (
    <ContentPreviewFrame
      state={state}
      problem={problem}
      onDownload={canDownload ? handleDownload : undefined}
      onRetry={handleRetry}
      labels={
        state === "previewUnavailable"
          ? { previewUnavailableMessage: buildPreviewUnavailableMessage(mimetype) }
          : undefined
      }
    />
  );
}
