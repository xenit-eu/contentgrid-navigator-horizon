/**
 * Shared problem-aware error state for entity-browser views.
 *
 * Maps a thrown error (ProblemDetailError / Error / unknown) to a
 * title + message pair using per-view labels, and renders the common
 * destructive error panel used by both the collection list and the
 * item detail views.
 */
import { AlertCircleIcon } from "lucide-react";
import { ProblemDetailError } from "@contentgrid/navigator-data";

export interface ErrorStateLabels {
  /** Title for unexpected/unknown errors. */
  defaultTitle: string;
  /** Message for unexpected/unknown errors. */
  defaultMessage: string;
  /** Message shown for a 403 problem (title is always "Access denied"). */
  forbiddenMessage: string;
  /** Title shown for a 404 problem. */
  notFoundTitle: string;
  /** Message shown for a 404 problem. */
  notFoundMessage: string;
}

export interface EntityErrorStateProps {
  error: unknown;
  labels: ErrorStateLabels;
}

export function EntityErrorState({ error, labels }: Readonly<EntityErrorStateProps>) {
  let title = labels.defaultTitle;
  let message = labels.defaultMessage;

  if (error instanceof ProblemDetailError) {
    const status = error.problemDetail.status;
    if (status === 403) {
      title = "Access denied";
      message = labels.forbiddenMessage;
    } else if (status === 404) {
      title = labels.notFoundTitle;
      message = labels.notFoundMessage;
    } else {
      title = error.problemDetail.title ?? title;
      message = error.problemDetail.detail ?? message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-[400px] rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircleIcon className="mx-auto mb-3 size-8 text-destructive" />
        <div className="mb-1 text-[15px] font-semibold text-destructive">{title}</div>
        <div className="text-[13px] leading-relaxed text-foreground/70">{message}</div>
      </div>
    </div>
  );
}
