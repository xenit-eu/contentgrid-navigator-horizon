import type { ReactNode } from "react";
import type { FieldValue } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import type { LayoutInformation } from "../model/layout-information";
import type { FieldState } from "../state/field-error";
import { FieldRenderer, type RelationFieldData } from "./field-renderer";

export interface FormContainerProps {
  readonly fields: readonly FieldDescriptor[];
  readonly layout: LayoutInformation;
  readonly values: Readonly<Record<string, FieldValue>>;
  readonly onChange: (name: string, value: FieldValue) => void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  /** See `field-renderer.tsx`'s `RelationFieldData` doc comment. Omitted entirely renders every
   * relation field as an inert "profile unavailable" placeholder. */
  readonly relationFieldData?: RelationFieldData;
  /** See `field-renderer.tsx`'s `FieldRendererProps.renderBottomChildren` doc comment. */
  readonly renderBottomChildren?: (fieldName: string) => ReactNode;
  /** See `field-renderer.tsx`'s `FieldRendererProps.onFocus`/`onBlur` doc comment. */
  readonly onFieldFocus?: (fieldName: string) => void;
  readonly onFieldBlur?: (fieldName: string) => void;
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
  relationFieldData,
  renderBottomChildren,
  onFieldFocus,
  onFieldBlur,
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
              <FieldRenderer
                key={name}
                field={field}
                value={values[name]}
                onChange={(value) => onChange(name, value)}
                fieldState={fieldState[name]}
                relationFieldData={relationFieldData}
                renderBottomChildren={renderBottomChildren}
                onFocus={onFieldFocus && (() => onFieldFocus(name))}
                onBlur={onFieldBlur && (() => onFieldBlur(name))}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
