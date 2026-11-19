import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  type EntityItem,
  needsRendition,
  toProblemDisplayModel,
  useContentPreview,
  useDownloadContent,
  useUploadContent,
} from "@contentgrid/navigator-data";
import { Badge } from "@contentgrid/ui";
import type { PdfViewerToolbarOptions } from "@contentgrid/ui";
import { getContentAttributeMetadata } from "../util/content-attribute-metadata";
import type { ViewerLoadErrorKind } from "../util/derive-content-preview-state";
import { deriveContentPreviewState } from "../util/derive-content-preview-state";
import { buildPreviewUnavailableMessage } from "../util/preview-unavailable-message";
import {
  ContentPreviewFrame,
  type ContentPreviewFrameLabels,
  cannotDisplayMessageAndIcon,
} from "./content-preview-frame";
import { ImageVideoViewer } from "./image-video-viewer";
import { PdfPreview } from "./pdf-preview";
import { saveBlobAsFile } from "./save-blob-as-file";

const FALLBACK_FILENAME = "document.pdf";

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

/**
 * Owns `useContentPreview` + `useDownloadContent` + `useUploadContent` for one content attribute
 * and renders the matching `ContentPreviewFrame` state (data-model.md's "Content preview panel state", FR-024).
 * A displayable PDF (stored or converted) is shown by `PdfPreview`. A stored image or
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
        saveBlobAsFile(download.blob, download.filename ?? metadata?.filename ?? FALLBACK_FILENAME);
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
      <PdfPreview
        // A different file gets a fresh viewer, so it never shows the previous file's failure.
        key={`${attributeName}:${previewSource.etag ?? ""}`}
        bytes={previewSource.bytes}
        filename={previewSource.filename}
        toolbar={toolbar}
        onDownload={handleDownload}
        onRetry={handleRetry}
        onLoadError={(error) => setViewerLoadErrorKind(error.kind)}
      />
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
  } else if (state === "cannotDisplay") {
    ({ labels: frameLabels, icon: frameIcon } = cannotDisplayMessageAndIcon(previewSource?.kind));
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
