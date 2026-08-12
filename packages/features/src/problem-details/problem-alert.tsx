import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { GenericProblemAlert } from "./generic-problem-alert";
import { RelationConflictAlert } from "./relation-conflict-alert";
import type { RelationConflictAlertProps } from "./relation-conflict-alert";
import { ValidationAlert, type ValidationAlertProps } from "./validation-alert";
import { VersionConflictAlert } from "./version-conflict-alert";

/**
 * Props for {@link ProblemAlert}. Every `on*Click` callback is optional — when
 * omitted, the corresponding action button simply isn't rendered. Only the
 * callbacks relevant to `model.kind` are ever used.
 */
export interface ProblemAlertProps
  extends
    Pick<
      ValidationAlertProps,
      | "onConflictingItemClick"
      | "onMissingRelationTargetClick"
      | "onAllowedValuesClick"
      | "onExpectedTypeClick"
    >,
    Pick<RelationConflictAlertProps, "onBlindRelationOverwriteClick" | "onRequiredRelationClick"> {
  /** Build with `toProblemDisplayModel(error)` from `@contentgrid/navigator-data`. */
  readonly model: ProblemDisplayModel;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
  /** Fires for an `unsatisfiedVersion` (HTTP 412) problem. */
  readonly onRetryClick?: () => void;
}

/**
 * Generic RFC 9457 problem-detail dispatcher. Feed it
 * `toProblemDisplayModel(error)` from `@contentgrid/navigator-data` — it
 * picks the right kind-specific alert component and forwards the matching
 * callbacks. Render a specific alert directly (`ValidationAlert`,
 * `RelationConflictAlert`, `VersionConflictAlert`, `GenericProblemAlert`)
 * instead when the call site already knows its problem kind.
 */
export function ProblemAlert({
  model,
  className,
  onClose,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  onRetryClick,
}: Readonly<ProblemAlertProps>) {
  switch (model.kind) {
    case "validation":
      return (
        <ValidationAlert
          model={model}
          className={className}
          onClose={onClose}
          onConflictingItemClick={onConflictingItemClick}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onAllowedValuesClick={onAllowedValuesClick}
          onExpectedTypeClick={onExpectedTypeClick}
        />
      );
    case "blindRelationOverwrite":
    case "requiredRelation":
      return (
        <RelationConflictAlert
          model={model}
          className={className}
          onClose={onClose}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onRequiredRelationClick={onRequiredRelationClick}
        />
      );
    case "unsatisfiedVersion":
      return (
        <VersionConflictAlert
          model={model}
          className={className}
          onClose={onClose}
          onRetryClick={onRetryClick}
        />
      );
    default:
      return <GenericProblemAlert model={model} className={className} onClose={onClose} />;
  }
}
