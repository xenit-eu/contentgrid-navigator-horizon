import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { nativePreviewKind } from "@contentgrid/navigator-data";
import type { PdfLoadError } from "@contentgrid/ui";
import type { ViewerLoadErrorKind } from "../util/derive-content-preview-state";
import { viewerLoadErrorState } from "../util/derive-content-preview-state";
import { buildPreviewUnavailableMessage } from "../util/preview-unavailable-message";
import { ContentPreviewFrame, cannotDisplayMessageAndIcon } from "./content-preview-frame";
import { ImageVideoViewer } from "./image-video-viewer";
import { PdfPreview } from "./pdf-preview";
import { saveBlobAsFile } from "./save-blob-as-file";

interface FilePreviewProps {
  /** A file picked on the user's device, not uploaded yet. */
  readonly file: File;
  /** Rendered at the start of the toolbar (e.g. a selector between file fields). */
  readonly toolbarStart?: ReactNode;
}

/**
 * Previews a file picked on the user's device, before anything is uploaded. A PDF opens in the
 * PDF viewer and an image or video is shown as it is; any other type has no preview here.
 */
export function FilePreview({ file, toolbarStart }: Readonly<FilePreviewProps>) {
  // Kept with the file it is about, so picking another file starts without it.
  const [loadError, setLoadError] = useState<{ file: File; kind: ViewerLoadErrorKind } | null>(
    null,
  );
  const loadErrorKind = loadError?.file === file ? loadError.kind : null;
  const previewKind = nativePreviewKind(file.type);

  function handleRetry() {
    setLoadError(null);
  }

  function handleDownload() {
    saveBlobAsFile(file, file.name);
  }

  if (loadErrorKind) {
    const state = viewerLoadErrorState(loadErrorKind);
    const frameProps = state === "cannotDisplay" ? cannotDisplayMessageAndIcon(previewKind) : {};
    return (
      <ContentPreviewFrame
        state={state}
        {...frameProps}
        onDownload={handleDownload}
        onRetry={handleRetry}
        toolbarStart={toolbarStart}
      />
    );
  }

  if (previewKind === "pdf") {
    return (
      <FilePdfPreview
        file={file}
        toolbarStart={toolbarStart}
        onDownload={handleDownload}
        onLoadError={(error) => setLoadError({ file, kind: error.kind })}
      />
    );
  }

  if (previewKind === "image" || previewKind === "video") {
    return (
      <ContentPreviewFrame state="ready">
        <ImageVideoViewer
          source={{ kind: previewKind, blob: file }}
          filename={file.name}
          toolbarStart={toolbarStart}
          onDownload={handleDownload}
          onLoadError={() => setLoadError({ file, kind: "invalid" })}
        />
      </ContentPreviewFrame>
    );
  }

  return (
    <ContentPreviewFrame
      state="previewUnavailable"
      labels={{ previewUnavailableMessage: buildPreviewUnavailableMessage(file.type) }}
      onDownload={handleDownload}
      toolbarStart={toolbarStart}
    />
  );
}

/** Reads the picked PDF's bytes and shows them in `PdfPreview`. */
function FilePdfPreview({
  file,
  toolbarStart,
  onDownload,
  onLoadError,
}: Readonly<{
  file: File;
  toolbarStart: ReactNode;
  onDownload: () => void;
  onLoadError: (error: PdfLoadError) => void;
}>) {
  // The bytes read from `file`; `null` bytes when it can no longer be read, e.g. it was deleted
  // or changed on disk after it was picked.
  const [fileRead, setFileRead] = useState<{ file: File; bytes: ArrayBuffer | null } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    file.arrayBuffer().then(
      (bytes) => {
        if (isCurrent) setFileRead({ file, bytes });
      },
      () => {
        if (isCurrent) setFileRead({ file, bytes: null });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [file]);

  if (fileRead?.file !== file) {
    return (
      <ContentPreviewFrame state="loading" onDownload={onDownload} toolbarStart={toolbarStart} />
    );
  }
  // The file itself may be fine, so this keeps the frame's own message, not the PDF's "invalid".
  if (!fileRead.bytes) {
    return <ContentPreviewFrame state="cannotDisplay" toolbarStart={toolbarStart} />;
  }

  return (
    <PdfPreview
      bytes={fileRead.bytes}
      filename={file.name}
      toolbar={{ start: toolbarStart }}
      onDownload={onDownload}
      onLoadError={onLoadError}
    />
  );
}
