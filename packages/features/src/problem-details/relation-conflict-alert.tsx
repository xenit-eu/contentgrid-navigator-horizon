import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { AlertActionSection, AlertButton } from "@contentgrid/ui";
import { ProblemAlertFrame } from "./problem-alert-frame";

export interface RelationConflictAlertProps {
  readonly model: Extract<
    ProblemDisplayModel,
    { kind: "blindRelationOverwrite" | "requiredRelation" }
  >;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
  /** Fires for a `blindRelationOverwrite` problem (HTTP 409). */
  readonly onBlindRelationOverwriteClick?: (info: {
    readonly existingItem?: string;
    readonly existingRelation?: string;
    readonly newItem?: string;
    readonly newRelation?: string;
  }) => void;
  /** Fires for a `requiredRelation` problem (HTTP 409). */
  readonly onRequiredRelationClick?: (affectedRelation: string) => void;
}

/**
 * Renders the two HTTP 409 relation-integrity problems: a blind
 * relation-overwrite attempt, or a delete/unlink blocked by a required
 * relation.
 */
export function RelationConflictAlert({
  model,
  className,
  onClose,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<RelationConflictAlertProps>) {
  return (
    <ProblemAlertFrame
      status={model.status}
      title={model.title}
      detail={model.detail}
      type={model.type}
      onClose={onClose}
      className={className}
    >
      <AlertActionSection>
        {model.kind === "blindRelationOverwrite" && onBlindRelationOverwriteClick && (
          <AlertButton
            type="button"
            onClick={() =>
              onBlindRelationOverwriteClick({
                existingItem: model.existingItem,
                existingRelation: model.existingRelation,
                newItem: model.newItem,
                newRelation: model.newRelation,
              })
            }
          >
            View existing link
          </AlertButton>
        )}
        {model.kind === "requiredRelation" && onRequiredRelationClick && (
          <AlertButton
            type="button"
            onClick={() => onRequiredRelationClick(model.affectedRelation)}
          >
            View affected relation
          </AlertButton>
        )}
      </AlertActionSection>
    </ProblemAlertFrame>
  );
}
