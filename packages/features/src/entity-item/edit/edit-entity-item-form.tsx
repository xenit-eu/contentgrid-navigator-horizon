import type { ReactNode, SubmitEvent } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import {
  type FieldState,
  HalFormsContainer,
  type HalFormsField,
  type LayoutSchema,
} from "../../hal-forms";

interface EditEntityItemFormProps {
  readonly fields: readonly HalFormsField[];
  readonly layout: LayoutSchema;
  readonly values: FieldValueMap;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly onFieldChange: (name: string, value: FieldValue) => void;
  readonly onFieldBlur: (name: string) => void;
  readonly onSubmit: (event: SubmitEvent) => void;
  readonly isSaving: boolean;
  /** False when saving again cannot succeed, e.g. the item no longer exists. */
  readonly canSave: boolean;
  readonly onCancel: () => void;
  /** Rendered above the fields — the error that has no field to show on. */
  readonly nonFieldErrorAlert?: ReactNode;
}

/**
 * Owns the `<form>` tag, the field list (via `HalFormsContainer`) and the Save/Cancel buttons — no
 * form state or mutation logic of its own (that's `edit-entity-item-container.tsx`).
 */
export function EditEntityItemForm({
  fields,
  layout,
  values,
  fieldState,
  onFieldChange,
  onFieldBlur,
  onSubmit,
  isSaving,
  canSave,
  onCancel,
  nonFieldErrorAlert,
}: Readonly<EditEntityItemFormProps>) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {nonFieldErrorAlert}

      <HalFormsContainer
        fields={fields}
        layout={layout}
        values={values}
        onChange={onFieldChange}
        onFieldBlur={onFieldBlur}
        fieldState={fieldState}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving || !canSave}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
