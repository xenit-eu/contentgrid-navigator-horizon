import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DownloadIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@phosphor-icons/react";
import type { PreviewSource } from "@contentgrid/navigator-data";
import { ToolbarIconButton, TooltipProvider } from "@contentgrid/ui";
import { ContentPreviewToolbar } from "./content-preview-toolbar";

const DOWNLOAD_LABEL = "Download";
const ACTUAL_SIZE_LABEL = "Actual size";
const FIT_TO_PANEL_LABEL = "Fit to panel";
const IMAGE_FALLBACK_ALT = "Content image";

export interface ImageVideoViewerProps {
  /** The image or video: a stored one as `useContentPreview` returned it, or a picked file. */
  readonly source: Pick<Extract<PreviewSource, { kind: "image" | "video" }>, "kind" | "blob">;
  /** The file's name, used as the image's alt text. */
  readonly filename: string | null;
  /** Rendered at the start of the toolbar (e.g. the content attribute selector). */
  readonly toolbarStart?: ReactNode;
  readonly onDownload: () => void;
  /** Fires when the browser cannot display the file (unknown image format, unsupported codec). */
  readonly onLoadError: () => void;
}

/**
 * Shows an image or video as it is, under a toolbar with the attribute selector and
 * Download. An image is shrunk to fit the panel until the user switches it to its actual size; a
 * video plays with the browser's own controls. The element reads the file through an object URL,
 * revoked when the file changes or the preview unmounts.
 */
export function ImageVideoViewer({
  source,
  filename,
  toolbarStart,
  onDownload,
  onLoadError,
}: Readonly<ImageVideoViewerProps>) {
  const [url, setUrl] = useState<string | null>(null);
  const [showActualSize, setShowActualSize] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(source.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [source.blob]);

  function handleToggleSize(): void {
    setShowActualSize((current) => !current);
  }

  const toolbarButtons = (
    <TooltipProvider>
      {source.kind === "image" && (
        // Like the PDF viewer's fullscreen button: the label and icon name what a click does.
        <ToolbarIconButton
          label={showActualSize ? FIT_TO_PANEL_LABEL : ACTUAL_SIZE_LABEL}
          onClick={handleToggleSize}
        >
          {showActualSize ? <MagnifyingGlassMinusIcon /> : <MagnifyingGlassPlusIcon />}
        </ToolbarIconButton>
      )}
      <ToolbarIconButton label={DOWNLOAD_LABEL} onClick={onDownload}>
        <DownloadIcon />
      </ToolbarIconButton>
    </TooltipProvider>
  );

  // `mx-auto` centres the file horizontally while it fits, and still lets the user scroll to every
  // edge of an image shown at its actual size. The file sits at the top of the panel.
  const imageSizeClass = showActualSize ? "max-w-none" : "max-h-full max-w-full object-contain";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ContentPreviewToolbar start={toolbarStart} end={toolbarButtons} />
      <div className="flex min-h-0 flex-1 items-start overflow-auto p-4">
        {url !== null && source.kind === "image" && (
          <img
            src={url}
            alt={filename ?? IMAGE_FALLBACK_ALT}
            onError={onLoadError}
            className={`mx-auto ${imageSizeClass}`}
          />
        )}
        {url !== null && source.kind === "video" && (
          <video
            src={url}
            controls
            onError={onLoadError}
            className="mx-auto max-h-full max-w-full"
          />
        )}
      </div>
    </div>
  );
}
