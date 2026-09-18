import { type ReactNode, type SubmitEvent, useEffect, useRef } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Button, Label, Switch } from "@contentgrid/ui";
import type { HalFormsField, LayoutSchema } from "../hal-forms";
import { HalFormsContainer } from "../hal-forms";
import type { FieldState } from "../hal-forms/state/field-error";

export interface CreateEntityItemFormProps {
  /** Already resolved by the caller (`create-entity-item-container.tsx`) via
   * `resolveHalFormsFields` — kept as a prop here rather than re-resolved from a
   * `createTemplate` prop, since the container already needs the same `fields`/`layout` for its
   * own annotation logic; resolving it twice from the same input would just be redundant work for
   * no independent-usability benefit (this component is only ever rendered by that container). */
  readonly fields: readonly HalFormsField[];
  readonly layout: LayoutSchema;
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
  /** "Keep creating entities" toggle state, persisted per session by the container — see
   * `create-entity-item-container.tsx`'s `CONTINUOUS_CREATE_KEY`. */
  readonly continuousCreate: boolean;
  readonly onContinuousCreateChange: (value: boolean) => void;
  /** Bumped by the container once per continuous-create reset (never on initial mount) — the
   * signal to refocus the first field. See the `useEffect` below. */
  readonly formResetCount: number;
}

/**
 * Owns the `<form>` tag, the field list (via `HalFormsContainer`), and the submit/cancel
 * buttons — entity-specific chrome only, no HAL-Forms parsing, form state, or mutation logic of
 * its own (that's `create-entity-item-container.tsx`, which resolves `fields`/`layout` and
 * renders this component).
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
  continuousCreate,
  onContinuousCreateChange,
  formResetCount,
}: Readonly<CreateEntityItemFormProps>) {
  const fieldsContainerRef = useRef<HTMLDivElement>(null);

  // `formResetCount` starts at 0 and is only bumped after a continuous-create reset (see the
  // container), so this never fires on the form's initial mount — only once a save has
  // completed and the fields have been cleared back to their defaults. Focusing the first
  // focusable descendant (in document order) is equivalent to focusing the first rendered
  // field, without needing to single that field out from the rest of the generic field list.
  useEffect(() => {
    if (formResetCount === 0) return;
    fieldsContainerRef.current
      ?.querySelector<HTMLElement>("input, button, [role='combobox']")
      ?.focus();
  }, [formResetCount]);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {nonFieldErrorAlert}

      <HalFormsContainer
        fields={fields}
        layout={layout}
        values={values}
        onChange={onFieldChange}
        onFieldFocus={onFieldFocus}
        onFieldBlur={onFieldBlur}
        fieldState={fieldState}
      />

      <div className="flex items-center gap-6">
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

        <div className="flex items-center gap-2">
          <Switch
            id="continuous-create"
            checked={continuousCreate}
            onCheckedChange={onContinuousCreateChange}
          />
          <Label htmlFor="continuous-create" className="text-muted-foreground font-normal">
            Keep creating entities
          </Label>
        </div>
      </div>
    </form>
  );
}
