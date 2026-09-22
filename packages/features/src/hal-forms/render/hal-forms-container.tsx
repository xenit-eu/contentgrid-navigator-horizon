import { useCallback } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@contentgrid/ui";
import type { HalFormsField } from "../model/hal-forms-field";
import type { FieldRow, FieldSection, LayoutSchema } from "../model/layout-schema";
import type { FieldState } from "../state/field-error";
import { HalFormsFieldRenderer } from "./hal-forms-field-renderer";

export interface HalFormsContainerProps {
  readonly fields: readonly HalFormsField[];
  readonly layout: LayoutSchema;
  readonly values: FieldValueMap;
  readonly onChange: (name: string, value: FieldValue) => void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly onFieldFocus?: (fieldName: string) => void;
  readonly onFieldBlur?: (fieldName: string) => void;
}

/**
 * Renders the field list, section by section — walks `layout.sections[].rows` ->
 * `HalFormsFieldRenderer` for each field name in each row. Generalizes `entity-item-create`'s
 * `FormContainer` (ADR-004) to this feature's row shape: a two-field row renders inside a 2-col
 * grid; a one-field row renders full width, same as every row did before rows existed for either
 * form type.
 *
 * A missing lookup (a row naming a field absent from `fields`) is silently skipped rather than
 * thrown — `resolveHalFormsFields` reconciles its rows against `fields` before this ever runs,
 * but a future multi-source layout has no such guarantee.
 */
export function HalFormsContainer({
  fields,
  layout,
  values,
  onChange,
  fieldState,
  onFieldFocus,
  onFieldBlur,
}: Readonly<HalFormsContainerProps>) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field] as const));

  return (
    <>
      {layout.sections.map((section, sectionIndex) => (
        <div
          key={section.title ?? sectionIndex}
          className={sectionIndex < layout.sections.length - 1 ? "border-b pb-4" : undefined}
        >
          <FieldSectionView
            section={section}
            fieldsByName={fieldsByName}
            values={values}
            onChange={onChange}
            fieldState={fieldState}
            onFieldFocus={onFieldFocus}
            onFieldBlur={onFieldBlur}
          />
        </div>
      ))}
    </>
  );
}

/**
 * One section's optional header (title/description, FR-025/FR-026) plus its rows. A collapsible
 * section (FR-027) wraps its rows in a single `Accordion` item — the section's rows
 * collapse/expand together as one unit, never per-row — with the header doubling as the toggle
 * trigger; collapsed by default (no `defaultValue`), unlike `RelationAccordion`'s own
 * expanded-by-default convention — a search form's relation-traversal sections (the only
 * collapsible ones this feature produces, see `generate-search-form-layout.ts`) start closed so
 * the filter dialog opens compact rather than pre-expanding every relation's fields. A
 * non-collapsible (or untitled — the only shape this feature produced before sections existed)
 * section just renders its header, if any, followed by its rows with no collapse behavior.
 */
function FieldSectionView({
  section,
  fieldsByName,
  values,
  onChange,
  fieldState,
  onFieldFocus,
  onFieldBlur,
}: Readonly<{
  section: FieldSection;
  fieldsByName: ReadonlyMap<string, HalFormsField>;
  values: FieldValueMap;
  onChange: (name: string, value: FieldValue) => void;
  fieldState: Readonly<Record<string, FieldState>>;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
}>) {
  const header =
    section.title || section.description ? (
      <div className="space-y-1">
        {section.title && <p className="text-sm font-semibold">{section.title}</p>}
        {section.description && (
          <p className="text-sm text-muted-foreground">{section.description}</p>
        )}
      </div>
    ) : null;

  const rows = (
    <FieldSectionRows
      rows={section.rows}
      fieldsByName={fieldsByName}
      values={values}
      onChange={onChange}
      fieldState={fieldState}
      onFieldFocus={onFieldFocus}
      onFieldBlur={onFieldBlur}
    />
  );

  if (!section.isCollapsible) {
    return (
      <div className="space-y-4">
        {header}
        {rows}
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="mt-4">
      <AccordionItem value="section" className="border-none">
        <AccordionTrigger type="button" className="py-0 hover:no-underline">
          {header}
        </AccordionTrigger>
        <AccordionContent className="mt-4 px-1">{rows}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function FieldSectionRows({
  rows,
  fieldsByName,
  values,
  onChange,
  fieldState,
  onFieldFocus,
  onFieldBlur,
}: Readonly<{
  rows: readonly FieldRow[];
  fieldsByName: ReadonlyMap<string, HalFormsField>;
  values: FieldValueMap;
  onChange: (name: string, value: FieldValue) => void;
  fieldState: Readonly<Record<string, FieldState>>;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
}>) {
  return (
    <div className="space-y-4">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={row.fieldNames.length > 1 ? "grid grid-cols-2 gap-4" : undefined}
        >
          {row.fieldNames.map((name) => {
            const field = fieldsByName.get(name);
            if (!field) return null;
            return (
              <HalFormsFormField
                key={name}
                field={field}
                value={values[name]}
                fieldState={fieldState[name]}
                onChange={onChange}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Per-field wrapper giving `HalFormsFieldRenderer` a referentially stable curried
 * `onChange`/`onFocus`/`onBlur` — see `entity-item-create/render/form-container.tsx`'s
 * `FormField` doc comment for why this matters (avoids re-rendering every field's widget on one
 * field's keystroke).
 */
function HalFormsFormField({
  field,
  value,
  fieldState,
  onChange,
  onFieldFocus,
  onFieldBlur,
}: Readonly<{
  field: HalFormsField;
  value: FieldValue;
  fieldState: FieldState | undefined;
  onChange: (name: string, value: FieldValue) => void;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
}>) {
  const { name } = field;
  const handleChange = useCallback((v: FieldValue) => onChange(name, v), [onChange, name]);
  const handleFocus = useCallback(() => onFieldFocus?.(name), [onFieldFocus, name]);
  const handleBlur = useCallback(() => onFieldBlur?.(name), [onFieldBlur, name]);

  return (
    <HalFormsFieldRenderer
      field={field}
      value={value}
      onChange={handleChange}
      fieldState={fieldState}
      onFocus={onFieldFocus && handleFocus}
      onBlur={onFieldBlur && handleBlur}
    />
  );
}
