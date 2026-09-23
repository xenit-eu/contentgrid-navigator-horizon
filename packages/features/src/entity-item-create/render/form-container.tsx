import { useCallback } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import type { RelationItemCreateHandler } from "../../entity-item";
import type { FieldDescriptor } from "../model/field-descriptor";
import type { LayoutInformation } from "../model/layout-information";
import type { FieldState } from "../state/field-state";
import { FieldRenderer } from "./field-renderer";

export interface FormContainerProps {
  readonly fields: readonly FieldDescriptor[];
  readonly layout: LayoutInformation;
  readonly values: FieldValueMap;
  readonly onChange: (name: string, value: FieldValue) => void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  /** See `field-renderer.tsx`'s `FieldRendererProps.onFocus`/`onBlur` doc comment. */
  readonly onFieldFocus?: (fieldName: string) => void;
  readonly onFieldBlur?: (fieldName: string) => void;
  /** See `field-renderer.tsx`'s `FieldRendererProps.onCreateNew` doc comment. */
  readonly onCreateNew?: RelationItemCreateHandler;
}

/**
 * Renders only the field list — walking `layout.groups` -> `FieldRenderer` for each field name
 * in each group. Does NOT own the `<form>` tag or submit/cancel chrome — those stay in
 * `create-entity-item-form.tsx`, the same responsibility split the pre-restructure component had.
 *
 * A missing lookup (a group referencing a field name absent from `fields`) is silently skipped
 * rather than thrown — `resolveCreateFieldDescriptors` is the only producer of both today and
 * always keeps them in sync, but a future multi-source layout has no such guarantee.
 */
export function FormContainer({
  fields,
  layout,
  values,
  onChange,
  fieldState,
  onFieldFocus,
  onFieldBlur,
  onCreateNew,
}: Readonly<FormContainerProps>) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field] as const));

  return (
    <>
      {layout.groups.map((group, groupIndex) => (
        <div key={group.title ?? groupIndex} className="space-y-4">
          {group.fieldNames.map((name) => {
            const field = fieldsByName.get(name);
            if (!field) return null;
            return (
              <FormField
                key={name}
                field={field}
                value={values[name]}
                fieldState={fieldState[name]}
                onChange={onChange}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
                onCreateNew={onCreateNew}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

/**
 * Per-field wrapper around the memoized `FieldRenderer`. `FormContainer`'s own `onChange` /
 * `onFieldFocus` / `onFieldBlur` are keyed by name, not by field, so every field needs its own
 * curried closure — but a fresh closure per render (the previous approach: an inline arrow
 * function built inline in the `.map()` above) gave `FieldRenderer` a "changed" prop on every
 * render regardless of `memo`, so ALL fields re-rendered on every keystroke in any ONE field, not
 * just the field that changed. `useCallback` here keeps each field's curried callback
 * referentially stable across renders where `onChange`/`onFieldFocus`/`onFieldBlur` themselves
 * don't change (see `useEntityItemCreateFormState`'s `setValue`/`touchField`, which are
 * `useCallback`-stable for the same reason) and the field's own `name` doesn't change.
 */
function FormField({
  field,
  value,
  fieldState,
  onChange,
  onFieldFocus,
  onFieldBlur,
  onCreateNew,
}: Readonly<{
  field: FieldDescriptor;
  value: FieldValue;
  fieldState: FieldState | undefined;
  onChange: (name: string, value: FieldValue) => void;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
  onCreateNew?: RelationItemCreateHandler;
}>) {
  const { name } = field;
  const handleChange = useCallback((v: FieldValue) => onChange(name, v), [onChange, name]);
  const handleFocus = useCallback(() => onFieldFocus?.(name), [onFieldFocus, name]);
  const handleBlur = useCallback(() => onFieldBlur?.(name), [onFieldBlur, name]);

  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={handleChange}
      fieldState={fieldState}
      onFocus={onFieldFocus && handleFocus}
      onBlur={onFieldBlur && handleBlur}
      onCreateNew={onCreateNew}
    />
  );
}
