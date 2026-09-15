import { type ReactNode, type SubmitEvent } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import type { FieldDescriptor } from "./model/field-descriptor";
import type { LayoutInformation } from "./model/layout-information";
import { FormContainer } from "./render/form-container";
import type { FieldState } from "./state/field-state";

export interface CreateEntityItemFormProps {
  /** Already resolved by the caller (`create-entity-item-container.tsx`) via
   * `resolveCreateFieldDescriptors` — kept as a prop here rather than re-resolved from a
   * `createTemplate` prop, since the container already needs the same `fields`/`layout` for its
   * own annotation logic; resolving it twice from the same input would just be redundant work for
   * no independent-usability benefit (this component is only ever rendered by that container). */
  readonly fields: readonly FieldDescriptor[];
  readonly layout: LayoutInformation;
  readonly values: FieldValueMap;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly onFieldChange: (name: string, value: FieldValue) => void;
  /** See `render/form-container.tsx`'s `FormContainerProps.onFieldFocus` doc comment — kept as
   * passthrough plumbing symmetric with `onFieldBlur` for a future consumer (e.g. a typeahead
   * field kicking off remote autocomplete on focus), with no current caller. */
  readonly onFieldFocus?: (name: string) => void;
  /** Marks a field touched on blur — see `useEntityItemCreateFormState`'s `touchField` doc comment. Shows a
   * required-and-empty field's error as soon as the user leaves it, without waiting for submit. */
  readonly onFieldBlur?: (name: string) => void;
  readonly onSubmit: (event: SubmitEvent) => void;
  readonly isSubmitting: boolean;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  /** Rendered as the first child inside the `<form>`, above the field list — the entity-level
   * (no `field`) validation/conflict alert computed by `create-entity-item-container.tsx`. */
  readonly nonFieldErrorAlert?: ReactNode;
}

/**
 * Owns the `<form>` tag, the field list (via `FormContainer`), and the submit/cancel buttons —
 * entity-specific chrome only, no HAL-Forms parsing, form state, or mutation logic of its own
 * (that's `create-entity-item-container.tsx`, which resolves `fields`/`layout` and renders this
 * component).
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
}: Readonly<CreateEntityItemFormProps>) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {nonFieldErrorAlert}

      <FormContainer
        fields={fields}
        layout={layout}
        values={values}
        onChange={onFieldChange}
        onFieldFocus={onFieldFocus}
        onFieldBlur={onFieldBlur}
        fieldState={fieldState}
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
