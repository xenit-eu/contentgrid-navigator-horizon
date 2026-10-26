import type { ReactNode } from "react";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button, FileUploadZone, Skeleton } from "@contentgrid/ui";
import { ProblemAlert } from "../../../../problem-details";
import {
  type ContentPreviewState,
  type ErrorPreviewState,
  RETRYABLE_PREVIEW_STATES,
} from "../util/content-preview-state";
import { ContentPreviewToolbar } from "./content-preview-toolbar";

export type { ContentPreviewState } from "../util/content-preview-state";

/** All strings the frame renders, overridable per FR-031; every field has an English default. */
export interface ContentPreviewFrameLabels {
  readonly noFileCaption?: string;
  readonly uploadingCaption?: string;
  readonly loadingCaption?: string;
  readonly preparingPreviewCaption?: string;
  readonly previewUnavailableMessage?: string;
  readonly couldNotPrepareMessage?: string;
  readonly couldNotRetrieveMessage?: string;
  readonly cannotDisplayMessage?: string;
  readonly protectedMessage?: string;
  readonly viewerFailureMessage?: string;
  readonly downloadButtonLabel?: string;
  readonly retryButtonLabel?: string;
}

const DEFAULT_LABELS: Required<ContentPreviewFrameLabels> = {
  noFileCaption: "No file",
  uploadingCaption: "Uploading…",
  loadingCaption: "Loading preview…",
  preparingPreviewCaption: "Preparing preview…",
  previewUnavailableMessage: "Preview isn't available for this file type.",
  couldNotPrepareMessage: "Couldn't prepare a preview for this file.",
  couldNotRetrieveMessage: "Couldn't retrieve this file.",
  cannotDisplayMessage: "This file can't be displayed.",
  protectedMessage: "This file is password protected.",
  viewerFailureMessage: "The viewer ran into a problem displaying this file.",
  downloadButtonLabel: "Download",
  retryButtonLabel: "Retry",
};

const ERROR_MESSAGE_LABEL_KEY: Record<ErrorPreviewState, keyof ContentPreviewFrameLabels> = {
  previewUnavailable: "previewUnavailableMessage",
  couldNotPrepare: "couldNotPrepareMessage",
  couldNotRetrieve: "couldNotRetrieveMessage",
  cannotDisplay: "cannotDisplayMessage",
  protected: "protectedMessage",
  viewerFailure: "viewerFailureMessage",
};

export interface ContentPreviewFrameProps {
  readonly state: ContentPreviewState;
  /** Rendered when `state === "ready"` — the actual viewer. */
  readonly children?: ReactNode;
  /**
   * Content-attribute selector (or any other toolbar-start node), rendered in a small header bar
   * above the state body for every state EXCEPT `"ready"` — there, the mounted viewer's own
   * toolbar already includes it (`content-preview-panel.tsx`). Keeps the
   * selector visible and usable no matter what state the current attribute is in, so a user can
   * always switch to a different content attribute — including away from one that errors out or
   * still needs a file uploaded.
   */
  readonly toolbarStart?: ReactNode;
  /**
   * A `toProblemDisplayModel(error)` result for an error state backed by a caught error
   * (`couldNotPrepare`, `couldNotRetrieve`, `viewerFailure`) — rendered via `ProblemAlert`
   * instead of the default message. Omitted for a state that is a plain `PreviewSource` variant
   * rather than a thrown error (`previewUnavailable`, `cannotDisplay`, `protected`). In the
   * `noFile` state it is a failed upload, shown above the drop zone.
   */
  readonly problem?: ProblemDisplayModel;
  /** Shown above an error state's message, e.g. a broken-image icon. */
  readonly icon?: ReactNode;
  /** Fires when the user clicks Download. Omitted hides the Download button. */
  readonly onDownload?: () => void;
  /**
   * Fires when the user clicks Retry. Only rendered for the states data-model.md marks Retry
   * (`couldNotPrepare`, `couldNotRetrieve`, `viewerFailure`) — a value passed for any other state
   * is ignored, matching the table exactly.
   */
  readonly onRetry?: () => void;
  /**
   * Fires when the user selects or drops a file on the "No file" drop zone. The drop zone is only
   * rendered when this is provided — omit it when the user may not upload to the attribute.
   */
  readonly onFileChange?: (file: File | null) => void;
  /** Percentage (0–100) of the file sent, shown after the caption in the `uploading` state. */
  readonly uploadProgress?: number;
  readonly labels?: ContentPreviewFrameLabels;
}

/**
 * Presentational: maps `state` to a skeleton, drop zone, message, or the viewer itself. Fetches
 * nothing — `ContentPreviewPanel` (T027) owns `useContentPreview`/`useDownloadContent`/
 * `useUploadContent` and derives `state`/`problem` from their results.
 */
export function ContentPreviewFrame({
  state,
  children,
  problem,
  icon,
  onDownload,
  onRetry,
  onFileChange,
  uploadProgress,
  toolbarStart,
  labels: labelOverrides,
}: Readonly<ContentPreviewFrameProps>) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  if (state === "ready") {
    return <div className="h-full min-h-0">{children}</div>;
  }

  let body: ReactNode;

  if (state === "noFile") {
    body = (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6">
        {problem && (
          <div className="w-full max-w-md">
            <ProblemAlert model={problem} />
          </div>
        )}
        {onFileChange && (
          <div className="w-full max-w-md">
            <FileUploadZone file={null} onFileChange={onFileChange} />
          </div>
        )}
        <p className="text-sm text-muted-foreground">{labels.noFileCaption}</p>
      </div>
    );
  } else if (state === "uploading" || state === "loading" || state === "preparingPreview") {
    let caption = labels.preparingPreviewCaption;
    if (state === "uploading") {
      // Stops at 99% until the server has confirmed the upload.
      caption = `${labels.uploadingCaption} ${Math.min(uploadProgress ?? 0, 99)}%`;
    } else if (state === "loading") {
      caption = labels.loadingCaption;
    }
    body = (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-full max-h-96 w-full max-w-md rounded-md" />
        <p className="text-sm text-muted-foreground">{caption}</p>
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            {labels.downloadButtonLabel}
          </Button>
        )}
      </div>
    );
  } else {
    const canRetry = onRetry !== undefined && RETRYABLE_PREVIEW_STATES.has(state);
    const message = labels[ERROR_MESSAGE_LABEL_KEY[state]];
    body = (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6">
        {icon && (
          <div className="flex size-16 items-center justify-center rounded-full border bg-secondary text-secondary-foreground [&_svg]:size-8">
            {icon}
          </div>
        )}
        <div className="w-full max-w-md">
          {problem ? (
            <ProblemAlert model={problem} />
          ) : (
            <p className="text-center text-sm text-muted-foreground">{message}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              {labels.downloadButtonLabel}
            </Button>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {labels.retryButtonLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!toolbarStart) {
    return body;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ContentPreviewToolbar start={toolbarStart} />
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
