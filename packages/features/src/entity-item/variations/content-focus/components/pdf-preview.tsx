import { Suspense, lazy, useState } from "react";
import type { ReactNode } from "react";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { PdfEngineProvider, PdfViewerErrorBoundary } from "@contentgrid/ui";
import type { PdfLoadError, PdfViewerToolbarOptions } from "@contentgrid/ui";
import { pdfiumWasmUrl } from "../util/pdfium-wasm-url";
import { ContentPreviewFrame } from "./content-preview-frame";

/**
 * Lazy import of `@contentgrid/ui`'s `PdfViewer` — its dependency (the PDFium/WASM engine, ~4.4
 * MB) only loads when a PDF is actually about to be shown, not on every page mount (research.md
 * §8.2 of spec 002-pdf-viewer). `React.lazy` requires a default export, so the named export is
 * remapped here.
 */
const LazyPdfViewer = lazy(() =>
  import("@contentgrid/ui").then((module) => ({ default: module.PdfViewer })),
);

interface PdfPreviewProps {
  readonly bytes: ArrayBuffer;
  readonly filename: string;
  readonly toolbar: PdfViewerToolbarOptions;
  readonly onDownload: () => void;
  /** Called on Retry after the viewer failed, before the preview starts again. */
  readonly onRetry?: () => void;
  readonly onLoadError: (error: PdfLoadError) => void;
}

interface ViewerFailureActions {
  readonly toolbarStart: ReactNode;
  readonly onDownload: () => void;
  readonly onRetry: () => void;
}

/** What the error boundary shows when the viewer throws. */
function viewerFailureFrame(error: Error, actions: ViewerFailureActions): ReactNode {
  return (
    <ContentPreviewFrame
      state="viewerFailure"
      problem={toProblemDisplayModel(error)}
      onDownload={actions.onDownload}
      toolbarStart={actions.toolbarStart}
      onRetry={actions.onRetry}
    />
  );
}

/**
 * Shows a PDF in the lazy-loaded `PdfViewer`, in its own `PdfEngineProvider` (self-hosted
 * `wasmUrl`) and a `PdfViewerErrorBoundary` that shows `viewerFailure` when the viewer throws.
 * Retry starts the viewer again with a fresh engine.
 */
export function PdfPreview({
  bytes,
  filename,
  toolbar,
  onDownload,
  onRetry,
  onLoadError,
}: Readonly<PdfPreviewProps>) {
  // Bumped on every Retry, so the error boundary and the engine below it start again.
  const [attempt, setAttempt] = useState(0);

  function handleRetry() {
    onRetry?.();
    setAttempt((count) => count + 1);
  }

  return (
    <ContentPreviewFrame state="ready">
      <PdfViewerErrorBoundary
        key={attempt}
        fallback={(error) =>
          viewerFailureFrame(error, {
            toolbarStart: toolbar.start,
            onDownload,
            onRetry: handleRetry,
          })
        }
      >
        <PdfEngineProvider wasmUrl={pdfiumWasmUrl}>
          <Suspense
            fallback={
              <ContentPreviewFrame
                state="loading"
                onDownload={onDownload}
                toolbarStart={toolbar.start}
              />
            }
          >
            <LazyPdfViewer
              bytes={bytes}
              filename={filename}
              wasmUrl={pdfiumWasmUrl}
              toolbar={toolbar}
              onDownload={onDownload}
              onLoadError={onLoadError}
            />
          </Suspense>
        </PdfEngineProvider>
      </PdfViewerErrorBoundary>
    </ContentPreviewFrame>
  );
}
