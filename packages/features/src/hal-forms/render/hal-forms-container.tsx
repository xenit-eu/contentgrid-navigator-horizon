import { useCallback, useId } from "react";
import type { FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@contentgrid/ui";
import type { RelationItemClickHandler, RelationItemCreateHandler } from "../../entity-item";
import type { HalFormsField } from "../model/hal-forms-field";
import {
  type FieldRow,
  type FieldSection,
  type FieldSectionItem,
  type LayoutSchema,
  isFieldRow,
} from "../model/layout-schema";
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
  /** Opens a linked item, as legacy's relation "details" action. */
  readonly onRelationItemClick?: RelationItemClickHandler;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
}

/**
 * Renders the field list, section by section — walks `layout.sections[].rows` ->
 * `HalFormsFieldRenderer` for each field name in each row (ADR-004): a two-field row renders
 * inside a 2-col grid; a one-field row renders full width.
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
  onRelationItemClick,
  onRelationItemCreateNew,
}: Readonly<HalFormsContainerProps>) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field] as const));

  return (
    <div className="mb-2">
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
            onRelationItemClick={onRelationItemClick}
            onRelationItemCreateNew={onRelationItemCreateNew}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * One section's optional header (title/description, FR-025/FR-026) plus its rows. A collapsible
 * section (FR-027) wraps its rows in a single `Accordion` item — the section's rows
 * collapse/expand together as one unit, never per-row — with the title as the toggle trigger and
 * the description rendered below it, outside the button, so it isn't part of the button's
 * accessible name; the content region points at it via `aria-describedby`, same as the nested
 * `fieldset` variant does. Expanded by default (FR-027), same as `RelationAccordion` — a search form's
 * relation-traversal sections (the only collapsible ones this feature produces, see
 * `generate-search-form-layout.ts`) must not hide an active relation filter (e.g. one applied
 * from a deep link) behind a closed header. A
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
  onRelationItemClick,
  onRelationItemCreateNew,
}: Readonly<{
  section: FieldSection;
  fieldsByName: ReadonlyMap<string, HalFormsField>;
  values: FieldValueMap;
  onChange: (name: string, value: FieldValue) => void;
  fieldState: Readonly<Record<string, FieldState>>;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
  onRelationItemClick?: RelationItemClickHandler;
  onRelationItemCreateNew?: RelationItemCreateHandler;
}>) {
  const descriptionId = useId();
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
      onRelationItemClick={onRelationItemClick}
      onRelationItemCreateNew={onRelationItemCreateNew}
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
    <Accordion type="single" collapsible defaultValue="section" className="mt-4">
      <AccordionItem value="section" className="border-none">
        <AccordionTrigger type="button" className="py-0 hover:no-underline">
          {section.title && <span className="text-sm font-semibold">{section.title}</span>}
        </AccordionTrigger>
        {section.description && (
          <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
            {section.description}
          </p>
        )}
        <AccordionContent
          className="mt-4 px-1"
          aria-describedby={section.description ? descriptionId : undefined}
        >
          {rows}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** The field-rendering inputs every level below `HalFormsContainer` passes straight through. */
interface FieldListProps {
  readonly fieldsByName: ReadonlyMap<string, HalFormsField>;
  readonly values: FieldValueMap;
  readonly onChange: (name: string, value: FieldValue) => void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly onFieldFocus?: (fieldName: string) => void;
  readonly onFieldBlur?: (fieldName: string) => void;
  readonly onRelationItemClick?: RelationItemClickHandler;
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
}

function FieldSectionRows({
  rows,
  ...fieldListProps
}: Readonly<{ rows: readonly FieldSectionItem[] } & FieldListProps>) {
  return (
    <div className="space-y-4">
      {rows.map((item, index) =>
        isFieldRow(item) ? (
          <FieldRowView key={index} row={item} {...fieldListProps} />
        ) : (
          <NestedFieldSectionView key={item.title ?? index} section={item} {...fieldListProps} />
        ),
      )}
    </div>
  );
}

/**
 * A section nested inside another section's rows — e.g. a search form's range attribute, whose
 * "Equals"/"From"/"Until" fields are labelled without the attribute name. A titled,
 * non-collapsible one renders as a `fieldset` with the title as its `legend` and the description
 * linked via `aria-describedby`, so assistive tech announces the attribute when entering the
 * group instead of just "From". Any other nested section renders like a top-level one.
 */
function NestedFieldSectionView({
  section,
  ...fieldListProps
}: Readonly<{ section: FieldSection } & FieldListProps>) {
  const descriptionId = useId();

  if (section.isCollapsible || !section.title) {
    return <FieldSectionView section={section} {...fieldListProps} />;
  }

  return (
    <fieldset aria-describedby={section.description ? descriptionId : undefined}>
      <legend className="mb-2 text-sm font-medium">{section.title}</legend>
      {section.description && (
        <p id={descriptionId} className="mb-2 text-sm text-muted-foreground">
          {section.description}
        </p>
      )}
      <FieldSectionRows rows={section.rows} {...fieldListProps} />
    </fieldset>
  );
}

/** One row's fields — side by side in a 2-col grid for a two-field row, full width otherwise. */
function FieldRowView({ row, ...fieldListProps }: Readonly<{ row: FieldRow } & FieldListProps>) {
  const {
    fieldsByName,
    values,
    fieldState,
    onChange,
    onFieldFocus,
    onFieldBlur,
    onRelationItemClick,
    onRelationItemCreateNew,
  } = fieldListProps;
  return (
    <div className={row.fieldNames.length > 1 ? "grid grid-cols-2 gap-4" : undefined}>
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
            onRelationItemClick={onRelationItemClick}
            onRelationItemCreateNew={onRelationItemCreateNew}
          />
        );
      })}
    </div>
  );
}

/**
 * Per-field wrapper giving the memoized `HalFormsFieldRenderer` a referentially stable curried
 * `onChange`/`onFocus`/`onBlur`. The container's own callbacks are keyed by name, not by field,
 * so every field needs its own curried closure — a fresh closure per render would give every
 * field a "changed" prop regardless of `memo`, re-rendering ALL fields on one field's keystroke.
 * `useCallback` keeps each one stable while the container's callbacks (`useHalFormsFieldState`'s
 * `setValue`/`touchField` are `useCallback`-stable for the same reason) and `name` don't change.
 */
function HalFormsFormField({
  field,
  value,
  fieldState,
  onChange,
  onFieldFocus,
  onFieldBlur,
  onRelationItemClick,
  onRelationItemCreateNew,
}: Readonly<{
  field: HalFormsField;
  value: FieldValue;
  fieldState: FieldState | undefined;
  onChange: (name: string, value: FieldValue) => void;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string) => void;
  onRelationItemClick?: RelationItemClickHandler;
  onRelationItemCreateNew?: RelationItemCreateHandler;
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
      onRelationItemClick={onRelationItemClick}
      onRelationItemCreateNew={onRelationItemCreateNew}
    />
  );
}
