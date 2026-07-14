import type { ProblemDisplayModel, ValidationFieldDisplay } from "@contentgrid/navigator-data";
import { AlertButton, AlertList, AlertListItem } from "@contentgrid/ui";
import { ProblemAlertFrame } from "./problem-alert-frame";

export interface ValidationAlertProps {
  readonly model: Extract<ProblemDisplayModel, { kind: "validation" }>;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
  /** Fires for a `duplicate` field error. */
  readonly onConflictingItemClick?: (url: string, field?: string) => void;
  /** Fires for a `missingRelationTarget` field error. */
  readonly onMissingRelationTargetClick?: (url: string, field?: string) => void;
  /** Fires for an `allowedValues` field error. */
  readonly onAllowedValuesClick?: (allowedValues: readonly unknown[], field?: string) => void;
  /** Fires for a `type` or `typeFormat` field error. */
  readonly onExpectedTypeClick?: (info: {
    readonly field?: string;
    readonly expectedType: string;
    readonly actualType?: string;
    readonly formatError?: string;
  }) => void;
}

function FieldActionButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <AlertButton type="button" onClick={onClick}>
      {label}
    </AlertButton>
  );
}

function ValidationFieldRow({
  field,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
}: Readonly<{
  field: ValidationFieldDisplay;
  onConflictingItemClick?: ValidationAlertProps["onConflictingItemClick"];
  onMissingRelationTargetClick?: ValidationAlertProps["onMissingRelationTargetClick"];
  onAllowedValuesClick?: ValidationAlertProps["onAllowedValuesClick"];
  onExpectedTypeClick?: ValidationAlertProps["onExpectedTypeClick"];
}>) {
  return (
    <AlertListItem>
      <span>
        {field.field && <span className="font-medium">{field.field}: </span>}
        {field.message}
      </span>
      {field.kind === "duplicate" && onConflictingItemClick && (
        <FieldActionButton
          label="View conflicting item"
          onClick={() => onConflictingItemClick(field.conflictingItem, field.field)}
        />
      )}
      {field.kind === "missingRelationTarget" && onMissingRelationTargetClick && (
        <FieldActionButton
          label="View missing item"
          onClick={() => onMissingRelationTargetClick(field.missingItem, field.field)}
        />
      )}
      {field.kind === "allowedValues" && onAllowedValuesClick && (
        <FieldActionButton
          label="View allowed values"
          onClick={() => onAllowedValuesClick(field.allowedValues, field.field)}
        />
      )}
      {field.kind === "type" && onExpectedTypeClick && (
        <FieldActionButton
          label="View expected type"
          onClick={() =>
            onExpectedTypeClick({
              field: field.field,
              expectedType: field.expectedType,
              actualType: field.actualType,
            })
          }
        />
      )}
      {field.kind === "typeFormat" && onExpectedTypeClick && (
        <FieldActionButton
          label="View expected type"
          onClick={() =>
            onExpectedTypeClick({
              field: field.field,
              expectedType: field.expectedType,
              formatError: field.formatError,
            })
          }
        />
      )}
    </AlertListItem>
  );
}

/**
 * Renders an `input/validation` problem (HTTP 400): the wrapper title/detail
 * plus one row per `errors[]` entry, with an action button when the field
 * kind has a matching callback.
 */
export function ValidationAlert({
  model,
  className,
  onClose,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
}: Readonly<ValidationAlertProps>) {
  return (
    <ProblemAlertFrame
      status={model.status}
      title={model.title}
      detail={model.detail}
      type={model.type}
      onClose={onClose}
      className={className}
    >
      {model.fields.length > 0 && (
        <AlertList>
          {model.fields.map((field, index) => (
            <ValidationFieldRow
              // Field errors have no stable id; index is fine since the list is static per render.
              key={`${field.field ?? ""}-${index}`}
              field={field}
              onConflictingItemClick={onConflictingItemClick}
              onMissingRelationTargetClick={onMissingRelationTargetClick}
              onAllowedValuesClick={onAllowedValuesClick}
              onExpectedTypeClick={onExpectedTypeClick}
            />
          ))}
        </AlertList>
      )}
    </ProblemAlertFrame>
  );
}
