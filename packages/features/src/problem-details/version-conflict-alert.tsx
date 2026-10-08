import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { AlertButton } from "@contentgrid/ui";
import { ProblemAlertFrame } from "./problem-alert-frame";

export interface VersionConflictAlertProps {
  readonly model: Extract<ProblemDisplayModel, { kind: "unsatisfiedVersion" }>;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
  /** Fires from the Refresh button: the caller reloads the latest version. */
  readonly onRetryClick?: () => void;
}

/**
 * Renders an `unsatisfied-version` problem (HTTP 412) — an `If-Match` ETag
 * mismatch — as "this item has been updated by someone else", with a Refresh button that asks
 * the caller to reload the latest version.
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
      title="This item has been updated by someone else"
      detail="Refresh to load the latest version."
      type={model.type}
      onClose={onClose}
      className={className}
    >
      {onRetryClick && (
        <AlertButton type="button" onClick={onRetryClick}>
          Refresh
        </AlertButton>
      )}
    </ProblemAlertFrame>
  );
}
