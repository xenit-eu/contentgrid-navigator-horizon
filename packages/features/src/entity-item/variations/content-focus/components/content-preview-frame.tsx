import type { ReactNode } from "react";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button, FileUploadZone, Skeleton } from "@contentgrid/ui";
import { ProblemAlert } from "../../../../problem-details";
import {
  type ContentPreviewState,
  type ErrorPreviewState,
  RETRYABLE_PREVIEW_STATES,
} from "../util/content-preview-state";

export type { ContentPreviewState } from "../util/content-preview-state";

/** All strings the frame renders, overridable per FR-031; every field has an English default. */
export interface ContentPreviewFrameLabels {
  readonly noFileCaption?: string;
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
   * above the state body for every state EXCEPT `"ready"` — there, the mounted `PdfViewer`'s own
   * toolbar already includes it via its `start` slot (`content-preview-panel.tsx`). Keeps the
   * selector visible and usable no matter what state the current attribute is in, so a user can
   * always switch to a different content attribute — including away from one that errors out or
   * still needs a file uploaded (round-2 review: "cannot look or switch content attributes when
   * one cannot be opened or needs to be uploaded").
   */
  readonly toolbarStart?: ReactNode;
  /**
   * A `toProblemDisplayModel(error)` result for an error state backed by a caught error
   * (`couldNotPrepare`, `couldNotRetrieve`, `viewerFailure`) — rendered via `ProblemAlert`
   * instead of the default message. Omitted for a state that is a plain `PreviewSource` variant
   * rather than a thrown error (`previewUnavailable`, `cannotDisplay`, `protected`).
   */
  readonly problem?: ProblemDisplayModel;
  /** Fires when the user clicks Download. Omitted hides the Download button. */
  readonly onDownload?: () => void;
  /**
   * Fires when the user clicks Retry. Only rendered for the states data-model.md marks Retry
   * (`couldNotPrepare`, `couldNotRetrieve`, `viewerFailure`) — a value passed for any other state
   * is ignored, matching the table exactly.
   */
  readonly onRetry?: () => void;
  /**
   * Fires when the user selects or drops a file on the "No file" drop zone. Per spec
   * `contracts/content-focus-view.md`, this is a no-op until the content-upload story wires it —
   * omitting it renders the drop zone as inert rather than throwing.
   */
  readonly onFileChange?: (file: File | null) => void;
  readonly labels?: ContentPreviewFrameLabels;
}

const NOOP_FILE_CHANGE = () => {
  /* no-op until the content-upload story wires this — see contracts/content-focus-view.md */
};

/**
 * Presentational: maps `state` to a skeleton, drop zone, message, or the viewer itself. Fetches
 * nothing — `ContentPreviewPanel` (T027) owns `useContentPreview`/`useDownloadContent` and
 * derives `state`/`problem` from their results.
 */
export function ContentPreviewFrame({
  state,
  children,
  problem,
  onDownload,
  onRetry,
  onFileChange,
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
        <div className="w-full max-w-md">
          <FileUploadZone file={null} onFileChange={onFileChange ?? NOOP_FILE_CHANGE} />
        </div>
        <p className="text-sm text-muted-foreground">{labels.noFileCaption}</p>
      </div>
    );
  } else if (state === "loading" || state === "preparingPreview") {
    const caption = state === "loading" ? labels.loadingCaption : labels.preparingPreviewCaption;
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
      {/* px-2 py-1.5 matches PdfViewerToolbar's row so both bars line up */}
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">{toolbarStart}</div>
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
