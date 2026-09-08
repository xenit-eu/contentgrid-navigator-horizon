import { type ReactNode, type SubmitEvent } from "react";
import type { FieldValue } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { type FieldDescriptor, isRelationField } from "./model/field-descriptor";
import type { LayoutInformation } from "./model/layout-information";
import type { FieldAnnotation, RelationFieldData } from "./render/field-renderer";
import { FormContainer } from "./render/form-container";
import type { FieldState } from "./state/field-error";

export interface CreateEntityItemFormProps {
  /** Already resolved by the caller (`create-entity-item-container.tsx`) via
   * `resolveCreateFieldDescriptors` — kept as a prop here rather than re-resolved from a
   * `createTemplate` prop, since the container already needs the same `fields`/`layout` for its
   * own annotation-filtering and relation-field logic; resolving it twice from the same input
   * would just be redundant work for no independent-usability benefit (this component is only
   * ever rendered by that container). */
  readonly fields: readonly FieldDescriptor[];
  readonly layout: LayoutInformation;
  readonly values: Readonly<Record<string, FieldValue>>;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly onFieldChange: (name: string, value: FieldValue) => void;
  /** See `render/form-container.tsx`'s `FormContainerProps.onFieldFocus` doc comment — kept as
   * passthrough plumbing symmetric with `onFieldBlur` for a future consumer (e.g. a typeahead
   * field kicking off remote autocomplete on focus), with no current caller. */
  readonly onFieldFocus?: (name: string) => void;
  /** Marks a field touched on blur — see `useEntityFormState`'s `touchField` doc comment. Shows a
   * required-and-empty field's error as soon as the user leaves it, without waiting for submit. */
  readonly onFieldBlur?: (name: string) => void;
  readonly onSubmit: (event: SubmitEvent) => void;
  readonly isSubmitting: boolean;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  /** Rendered as the first child inside the `<form>`, above the field list — the entity-level
   * (no `field`) validation/conflict alert computed by `create-entity-item-container.tsx`. */
  readonly nonFieldErrorAlert?: ReactNode;
  readonly relationFieldData?: RelationFieldData;
  /** Per-field extraction data, keyed by field name — see `render/field-renderer.tsx`'s
   * `FieldAnnotation` doc comment. This component turns it into the generic
   * `FormContainerProps.renderBottomChildren` slot (a "Use extracted value" button per
   * annotated field) rather than threading `FieldAnnotation` itself any further down. */
  readonly annotations?: Readonly<Record<string, FieldAnnotation>>;
  /**
   * Fired when the user wants every annotated field's extracted value applied at once —
   * `create-entity-item-container.tsx` builds this from `useEntityFormState`'s bulk `setValues`,
   * so all annotated fields update (and dismiss their errors) in a single commit rather than one
   * `onFieldChange` call per field. Only rendered when both this and `annotations` are non-empty.
   */
  readonly onApplyAllAnnotations?: () => void;
}

/**
 * Owns the `<form>` tag, the field list (via `FormContainer`), and the submit/cancel buttons —
 * entity-specific chrome only, no HAL-Forms parsing, form state, or mutation logic of its own
 * (that's `create-entity-item-container.tsx`, which resolves `fields`/`layout` and renders this
 * component). Direct replacement for the "form fields" half of the retired, monolithic
 * `create-entity-item-form.tsx` (formerly the inner `CreateEntityItemFormFields`).
 */
export function CreateEntityItemForm({
  fields,
  layout,
  values,
  fieldState,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  onSubmit,
  isSubmitting,
  onCancel,
  nonFieldErrorAlert,
  relationFieldData,
  annotations,
  onApplyAllAnnotations,
}: Readonly<CreateEntityItemFormProps>) {
  // Annotations only ever apply to plain attribute fields — see `isRelationField`'s doc comment.
  const applicableAnnotationCount = annotations
    ? Object.keys(annotations).filter((name) => !isRelationField(fields, name)).length
    : 0;

  function renderBottomChildren(fieldName: string) {
    const annotation = annotations?.[fieldName];
    if (!annotation || isRelationField(fields, fieldName)) return null;
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => onFieldChange(fieldName, annotation.extractedValue)}
      >
        Use extracted value
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {nonFieldErrorAlert}

      {onApplyAllAnnotations && applicableAnnotationCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm">
          <span>
            {applicableAnnotationCount} field{applicableAnnotationCount === 1 ? "" : "s"} have an
            extracted value available.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onApplyAllAnnotations}>
            Apply all extracted values
          </Button>
        </div>
      )}

      <FormContainer
        fields={fields}
        layout={layout}
        values={values}
        onChange={onFieldChange}
        onFieldFocus={onFieldFocus}
        onFieldBlur={onFieldBlur}
        fieldState={fieldState}
        relationFieldData={relationFieldData}
        renderBottomChildren={annotations ? renderBottomChildren : undefined}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
