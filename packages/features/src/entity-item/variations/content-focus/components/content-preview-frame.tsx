import type { ReactNode } from "react";
import { FileXIcon, ImageBrokenIcon, VideoCameraSlashIcon } from "@phosphor-icons/react";
import type { PreviewSource, ProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button, DEFAULT_PDF_VIEWER_LABELS, FileUploadZone, Skeleton } from "@contentgrid/ui";
import { ProblemAlert } from "../../../../problem-details";
import {
  type ContentPreviewState,
  type ErrorPreviewState,
  RETRYABLE_PREVIEW_STATES,
} from "../util/content-preview-state";
import { ContentPreviewToolbar } from "./content-preview-toolbar";

export type { ContentPreviewState } from "../util/content-preview-state";

/**
 * The `cannotDisplay` message and icon for a PDF, image or video that could not be opened. Any
 * other kind keeps the frame's default message.
 */
export function cannotDisplayMessageAndIcon(
  kind: PreviewSource["kind"] | undefined,
): Pick<ContentPreviewFrameProps, "labels" | "icon"> {
  switch (kind) {
    case "pdf":
      return {
        labels: { cannotDisplayMessage: DEFAULT_PDF_VIEWER_LABELS.invalidDocument },
        icon: <FileXIcon aria-hidden />,
      };
    case "image":
      return {
        labels: { cannotDisplayMessage: buildCannotDisplayMessage("image") },
        icon: <ImageBrokenIcon aria-hidden />,
      };
    case "video":
      return {
        labels: { cannotDisplayMessage: buildCannotDisplayMessage("video") },
        icon: <VideoCameraSlashIcon aria-hidden />,
      };
    default:
      return {};
  }
}

/** An image or video the browser can't open names which of the two it is. */
function buildCannotDisplayMessage(kind: "image" | "video"): string {
  return `Your browser can't open this ${kind}. You can download it instead.`;
}

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
  viewerFailureMessage: "The viewer ran into a problem displaying this file.",
  downloadButtonLabel: "Download",
  retryButtonLabel: "Retry",
};

const ERROR_MESSAGE_LABEL_KEY: Record<ErrorPreviewState, keyof ContentPreviewFrameLabels> = {
  previewUnavailable: "previewUnavailableMessage",
  couldNotPrepare: "couldNotPrepareMessage",
  couldNotRetrieve: "couldNotRetrieveMessage",
  cannotDisplay: "cannotDisplayMessage",
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
   * rather than a thrown error (`previewUnavailable`, `cannotDisplay`). In the
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
  /** Makes the "No file" drop zone fill the frame instead of a small box in its middle. */
  readonly fill?: boolean;
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
  fill,
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
      <NoFileBody
        problem={problem}
        onFileChange={onFileChange}
        fill={fill}
        noFileCaption={labels.noFileCaption}
      />
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

interface NoFileBodyProps {
  readonly problem?: ProblemDisplayModel;
  readonly onFileChange?: (file: File | null) => void;
  readonly fill?: boolean;
  readonly noFileCaption: string;
}

/** The "No file" state: a failed upload's problem, then the drop zone or, without one, a caption. */
function NoFileBody({ problem, onFileChange, fill, noFileCaption }: Readonly<NoFileBodyProps>) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6">
      {problem && (
        <div className="w-full max-w-md">
          <ProblemAlert model={problem} />
        </div>
      )}
      {/* The drop zone already says there is no file; the caption is for when it is absent. */}
      {onFileChange ? (
        <div className={fill ? "min-h-0 w-full flex-1" : "w-full max-w-md"}>
          <FileUploadZone file={null} onFileChange={onFileChange} fill={fill} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{noFileCaption}</p>
      )}
    </div>
  );
}
