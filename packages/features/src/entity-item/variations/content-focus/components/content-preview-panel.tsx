import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ImageBrokenIcon, VideoCameraSlashIcon } from "@phosphor-icons/react";
import {
  type EntityItem,
  needsRendition,
  toProblemDisplayModel,
  useContentPreview,
  useDownloadContent,
  useUploadContent,
} from "@contentgrid/navigator-data";
import { Badge, PdfEngineProvider, PdfViewerErrorBoundary } from "@contentgrid/ui";
import type { PdfLoadError, PdfViewerToolbarOptions } from "@contentgrid/ui";
import { getContentAttributeMetadata } from "../util/content-attribute-metadata";
import type { ViewerLoadErrorKind } from "../util/derive-content-preview-state";
import { deriveContentPreviewState } from "../util/derive-content-preview-state";
import { pdfiumWasmUrl } from "../util/pdfium-wasm-url";
import { ContentPreviewFrame, type ContentPreviewFrameLabels } from "./content-preview-frame";
import { ImageVideoViewer } from "./image-video-viewer";

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

/** `cannotDisplay`'s message for a stored image or video names which of the two it is. */
function buildCannotDisplayMessage(kind: "image" | "video"): string {
  return `Your browser can't open this ${kind}. You can download it instead.`;
}

export interface ContentPreviewPanelProps {
  readonly entityItem: EntityItem;
  readonly attributeName: string;
  /**
   * Content to render at the start of the preview's toolbar — the view (per
   * `contracts/content-focus-view.md`'s "Components" section) passes its `ContentAttributeSelector`
   * here so the user can switch attributes from whatever is shown: the PDF viewer's toolbar, the
   * image or video toolbar, or the frame's header bar in every other state. The panel itself has
   * no attribute-selection logic.
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
 * Owns `useContentPreview` + `useDownloadContent` + `useUploadContent` for one content attribute
 * and renders the matching `ContentPreviewFrame` state (data-model.md's "Content preview panel state", FR-024).
 * Lazy-loads `@contentgrid/ui`'s `PdfViewer` — wrapped in `PdfViewerErrorBoundary` (catches a
 * render-time exception → `viewerFailure`) and its own `PdfEngineProvider` (self-hosted
 * `wasmUrl`) — only once a displayable PDF (stored or converted) is available. A stored image or
 * video is shown by `ImageVideoViewer` instead; one the browser cannot display reports
 * `cannotDisplay`, like an invalid PDF.
 */
export function ContentPreviewPanel({
  entityItem,
  attributeName,
  toolbarStart,
}: Readonly<ContentPreviewPanelProps>) {
  const query = useContentPreview(entityItem, attributeName);
  const previewSource = query.data;
  const downloadMutation = useDownloadContent(entityItem, attributeName);
  const uploadMutation = useUploadContent(entityItem, attributeName);
  // The attribute the upload was started on: other attributes don't show its progress or error.
  const [uploadAttributeName, setUploadAttributeName] = useState<string | null>(null);
  const canUpload = entityItem.canUploadContent(attributeName);

  // Leaving the attribute of a finished upload forgets that upload, so its error isn't shown
  // again when the user comes back. An upload still running is kept, so its progress is.
  const [shownAttributeName, setShownAttributeName] = useState(attributeName);
  if (attributeName !== shownAttributeName) {
    setShownAttributeName(attributeName);
    if (shownAttributeName === uploadAttributeName && !uploadMutation.isPending) {
      setUploadAttributeName(null);
    }
  }
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
      : needsRendition(metadata.mimetype)
        ? "rendition"
        : "stored";

  const { state, problem, mimetype } = deriveContentPreviewState({
    queryStatus: query.status,
    previewSource,
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

  function handleUpload(file: File | null): void {
    if (file) {
      setUploadAttributeName(attributeName);
      // Only offered in the "No file" state, so there is no stored content to match.
      uploadMutation.mutate({ file, contentEtag: null });
    }
  }

  function handleRetry(): void {
    setViewerLoadErrorKind(null);
    setRetryToken((token) => token + 1);
    void query.refetch();
  }

  const canDownload = metadata !== null && metadata !== undefined;

  if (state === "ready" && (previewSource?.kind === "image" || previewSource?.kind === "video")) {
    return (
      <ContentPreviewFrame state="ready">
        <ImageVideoViewer
          // A different file gets a fresh element, so it never shows the previous file.
          key={`${attributeName}:${previewSource.etag ?? ""}`}
          source={previewSource}
          filename={metadata?.filename ?? null}
          toolbarStart={toolbarStart}
          onDownload={handleDownload}
          // The browser can't show this image or video: the same state as a PDF that can't be opened.
          onLoadError={() => setViewerLoadErrorKind("invalid")}
        />
      </ContentPreviewFrame>
    );
  }

  if (state === "ready" && previewSource?.kind === "pdf") {
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
          fallback={(error, reset) => (
            <ContentPreviewFrame
              state="viewerFailure"
              problem={toProblemDisplayModel(error)}
              onDownload={handleDownload}
              toolbarStart={toolbarStart}
              onRetry={() => {
                // `reset()` clears the boundary's own caught-error state — without it, the
                // boundary keeps rendering this fallback forever, no matter how many times
                // `handleRetry()` below remounts the subtree underneath it (bumping
                // `retryToken`/refetching): the boundary's `render()` checks its own `state.error`
                // before ever reaching its children, so a fresh subtree never gets a chance to
                // render until the boundary itself is told the error is cleared.
                handleRetry();
                reset();
              }}
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

  const attributeUpload = uploadAttributeName === attributeName ? uploadMutation : undefined;

  if (attributeUpload?.isPending) {
    return (
      <ContentPreviewFrame
        state="uploading"
        uploadProgress={attributeUpload.progress}
        toolbarStart={toolbarStart}
      />
    );
  }

  const uploadProblem =
    state === "noFile" && attributeUpload?.error
      ? toProblemDisplayModel(attributeUpload.error)
      : undefined;

  // Message (and icon) for the states that have their own wording.
  let frameLabels: ContentPreviewFrameLabels | undefined;
  let frameIcon: ReactNode;
  if (state === "previewUnavailable") {
    frameLabels = { previewUnavailableMessage: buildPreviewUnavailableMessage(mimetype) };
  } else if (state === "cannotDisplay" && previewSource?.kind === "image") {
    frameLabels = { cannotDisplayMessage: buildCannotDisplayMessage("image") };
    frameIcon = <ImageBrokenIcon aria-hidden />;
  } else if (state === "cannotDisplay" && previewSource?.kind === "video") {
    frameLabels = { cannotDisplayMessage: buildCannotDisplayMessage("video") };
    frameIcon = <VideoCameraSlashIcon aria-hidden />;
  }

  return (
    <ContentPreviewFrame
      state={state}
      problem={uploadProblem ?? problem}
      icon={frameIcon}
      // One upload at a time: no drop zone on another attribute while an upload is running.
      onFileChange={
        state === "noFile" && canUpload && !uploadMutation.isPending ? handleUpload : undefined
      }
      onDownload={canDownload ? handleDownload : undefined}
      onRetry={handleRetry}
      // Every non-"ready" state still offers the attribute selector, so the user can switch away
      // from an attribute that can't be opened or still needs a file uploaded — the "ready"
      // branches above pass it to the viewer's own toolbar instead.
      toolbarStart={toolbarStart}
      labels={frameLabels}
    />
  );
}
