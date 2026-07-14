import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { AlertButton } from "@contentgrid/ui";
import { ProblemAlertFrame } from "./problem-alert-frame";

export interface VersionConflictAlertProps {
  readonly model: Extract<ProblemDisplayModel, { kind: "unsatisfiedVersion" }>;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
  /** Fires when the user chooses to re-fetch, re-apply, and retry the mutation. */
  readonly onRetryClick?: () => void;
}

/**
 * Renders an `unsatisfied-version` problem (HTTP 412) — an `If-Match` ETag
 * mismatch. The caller decides what "retry" means (re-fetch + re-apply).
 */
export function VersionConflictAlert({
  model,
  className,
  onClose,
  onRetryClick,
}: Readonly<VersionConflictAlertProps>) {
  return (
    <ProblemAlertFrame
      status={model.status}
      title={model.title}
      detail={model.detail}
      type={model.type}
      onClose={onClose}
      className={className}
    >
      {onRetryClick && (
        <AlertButton type="button" onClick={onRetryClick}>
          Retry
        </AlertButton>
      )}
    </ProblemAlertFrame>
  );
}
