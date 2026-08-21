import { useMemo, useRef, useState } from "react";
import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import {
  type DefinedHalFormValue,
  type HalFormValues,
  createValues,
} from "@contentgrid/hal-forms/values";
import type { TypedRequestSpec } from "@contentgrid/typed-fetch";
import type { RenderFieldDescriptor } from "./render-field-descriptor";

/**
 * `DefinedHalFormValue["value"]` (not the wire-level `HalFormsPropertyValue`) — this is the
 * already-JS-typed value shape `HalFormValues.withValue()` actually accepts, including `Date`
 * for datetime fields and `File` for file uploads, neither of which the wire-level value type
 * carries.
 */
export type FieldValue = DefinedHalFormValue["value"] | undefined;

export interface UseFormFieldsOptions {
  readonly fields: readonly RenderFieldDescriptor[];
  /** Existing values, keyed by property name (edit mode). Omitted fields start at a type-appropriate empty value. */
  readonly initialValues?: Readonly<Record<string, FieldValue>>;
  /**
   * Per-field server errors, keyed by property name — e.g. from
   * `getValidationFieldErrors(error)` after a failed submit. Merged with (and overridden by)
   * client-side required-field errors from `validate()`.
   */
  readonly serverErrors?: Readonly<Record<string, string>>;
}

export interface UseFormFieldsResult {
  readonly values: Readonly<Record<string, FieldValue>>;
  setValue(name: string, value: FieldValue): void;
  readonly errors: Readonly<Record<string, string>>;
  readonly isDirty: boolean;
  /** Runs client-side required-field validation; returns true when the form may be submitted. */
  validate(): boolean;
  /** Encodes the current values against a HAL-FORMS template. Empty/untouched fields are omitted. */
  buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec>;
  reset(): void;
}

/**
 * A field's initial value when none was supplied. Text-like fields default to `""` rather than
 * `undefined` so they start as controlled inputs — the same reason the prototype's
 * `EntityFormContent` seeded checkboxes with `false` and everything else with `""`
 * (contentgrid-navigator-prototype/src/components/entities/entity-form.tsx:36-42). Fields backed
 * by a non-native-input component (`relation-to-one`, `file`) default to `undefined` instead —
 * `EntityPicker`/`FileUploadZone` don't need a placeholder value, and `undefined` doubles as
 * "omit from `buildValues()`" for a field the user hasn't touched yet.
 *
 * `date-range` is never passed here — its two sub-properties (`from`/`until`) are seeded
 * individually by `initializeValues` under their own property names.
 */
function defaultValueFor(
  field: Exclude<RenderFieldDescriptor, { type: "date-range" }>,
): FieldValue {
  switch (field.type) {
    case "boolean":
      return false;
    case "enum-multi":
    case "relation-to-many":
      return [];
    case "relation-to-one":
    case "file":
      return undefined;
    case "text":
    case "number":
    case "datetime":
    case "enum":
    case "typeahead":
      return "";
  }
}

function initializeValues(
  fields: readonly RenderFieldDescriptor[],
  initialValues: Readonly<Record<string, FieldValue>> | undefined,
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    if (field.type === "date-range") {
      values[field.from.name] = initialValues?.[field.from.name] ?? "";
      values[field.until.name] = initialValues?.[field.until.name] ?? "";
      continue;
    }
    values[field.name] = initialValues?.[field.name] ?? defaultValueFor(field);
  }
  return values;
}

/**
 * A `boolean` value is never empty, `false` included — a required boolean attribute's
 * constraint (per root CLAUDE.md's validation error list) is "must have a value", not
 * "must be `true`". Booleans always have a defined value once seeded by
 * `defaultValueFor()`, so `required` on a boolean field is inherently always satisfied;
 * that mirrors the server, which has no "must be true" constraint type. A checkbox that
 * must be explicitly checked (e.g. terms acceptance) is a product-level `allowed-values`
 * constraint, not `required`, and would validate through that path instead.
 */
function isEmpty(value: FieldValue): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Array-valued fields (`enum-multi`, `relation-to-many`) are always a freshly-built array —
 * e.g. unlinking a relation produces a new `[]` — so plain `!==` would report a field as dirty
 * forever after it's touched, even once its content matches the initial value again.
 */
function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/**
 * True for an `enum`/`enum-multi` field whose allowed values come from a remote link that
 * `packages/ui` has no way to resolve (fetching stays out of the rendering layer — see
 * packages/ui/CLAUDE.md). The renderer can't offer the user any value to pick for such a
 * field, so client-side `required` validation must not block submission on it — the server's
 * own validation still enforces it and reports back through the existing server-error path.
 */
function hasUnresolvableRemoteOptions(field: RenderFieldDescriptor): boolean {
  return (
    (field.type === "enum" || field.type === "enum-multi") && field.optionsSource.kind === "remote"
  );
}

/**
 * Required-field descriptors as (name, label) pairs — `date-range` expands to its two
 * independently-named sub-properties, since required-ness is checked per encodable property,
 * not per descriptor.
 */
function requiredFieldEntries(
  fields: readonly RenderFieldDescriptor[],
): readonly { name: string; label: string }[] {
  return fields
    .filter((field) => field.required && !hasUnresolvableRemoteOptions(field))
    .flatMap((field) =>
      field.type === "date-range"
        ? [field.from, field.until]
        : [{ name: field.name, label: field.label }],
    );
}

/**
 * Hand-rolled form-state hook (ADR-004's `useFormFields` direction — TanStack Form and React
 * Hook Form were both considered and rejected there: forms here are server-driven from
 * `RenderFieldDescriptor[]`, not user-defined schemas). Generalizes the value/dirty/validation state
 * that the prototype managed inline in `EntityFormContent`
 * (contentgrid-navigator-prototype/src/components/entities/entity-form.tsx) into a hook that
 * operates on `RenderFieldDescriptor[]` instead of raw profile attributes, and encodes via
 * `createValues()` instead of hand-rolled number/date coercion.
 *
 * Values are stored already-typed (`HalFormsPropertyValue`), not as raw input strings — coercing
 * a native input event to the right JS type is the calling renderer's job (mirrors
 * `packages/features/src/search/filter-properties.ts`'s `coerceFilterValue`, which performs the
 * same coercion for FilterSidebar's inputs). This hook never imports from `packages/ui`; the
 * caller (a route or feature wrapper) reads `values`/`errors` and passes plain props down to
 * `packages/ui` renderers, the same boundary `SearchFilterProperty` already establishes.
 */
export function useFormFields({
  fields,
  initialValues,
  serverErrors = {},
}: UseFormFieldsOptions): UseFormFieldsResult {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initializeValues(fields, initialValues),
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const initialValuesRef = useRef(values);

  const requiredFields = useMemo(() => requiredFieldEntries(fields), [fields]);

  const isDirty = useMemo(
    () =>
      Object.keys(values).some(
        (name) => !valuesEqual(values[name], initialValuesRef.current[name]),
      ),
    [values],
  );

  function setValue(name: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const { name, label } of requiredFields) {
      if (isEmpty(values[name])) {
        nextErrors[name] = `${label} is required`;
      }
    }
    setClientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec> {
    return Object.entries(values).reduce((vals, [name, value]) => {
      if (value === undefined || value === "") return vals;
      // Also omit an empty array (the seeded default for an untouched enum-multi /
      // relation-to-many field, mirroring isEmpty()'s array case above) — the
      // HAL-FORMS codec rejects an empty list for a multi-value property outright,
      // so an untouched one must be omitted, not sent.
      if (Array.isArray(value) && value.length === 0) return vals;
      return vals.withValue(name, value);
    }, createValues(template));
  }

  function reset() {
    setValues(initialValuesRef.current);
    setClientErrors({});
  }

  return {
    values,
    setValue,
    // Client errors win over server errors for the same field — matches the prototype's
    // `validationErrors[name] ?? fieldErrors.find(...)` precedence.
    errors: { ...serverErrors, ...clientErrors },
    isDirty,
    validate,
    buildValues,
    reset,
  };
}
