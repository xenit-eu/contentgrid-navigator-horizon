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

/**
 * Stable shared reference for the `serverErrors` default — avoids allocating a fresh `{}` on
 * every render for the common "no server errors" case. Not load-bearing for correctness (the
 * dismissal-reset logic below compares `serverErrors` by *content*, not reference — see
 * `sameServerErrors`), but a default parameter expression is otherwise re-evaluated on every
 * call, so this is a cheap avoidance of needless allocation.
 */
const EMPTY_SERVER_ERRORS: Readonly<Record<string, string>> = {};

/**
 * Shallow content equality for two flat string-keyed error maps. Deliberately NOT a reference
 * (`!==`) check: a caller that passes an inline object literal for `serverErrors` (as many will,
 * and as the hook's own tests do) creates a new object every render even when nothing about the
 * errors actually changed — reference comparison would treat that as "a new error map arrived"
 * on every single render and reset the dismissal tracking every time, which for the specific
 * comparison below (guarding a render-phase `setState` call) is an infinite re-render loop, not
 * just a correctness bug.
 */
function sameServerErrors(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export interface UseFormFieldsOptions {
  readonly fields: readonly RenderFieldDescriptor[];
  /** Existing values, keyed by property name (edit mode). Omitted fields start at a type-appropriate empty value. */
  readonly initialValues?: Readonly<Record<string, FieldValue>>;
  /**
   * Per-field server errors, keyed by property name — e.g. from
   * `getValidationFieldErrors(error)` after a failed submit. Merged with (and overridden by)
   * client-side required-field errors from `validate()`. A field's server error is dismissed
   * (hidden from `errors`, without mutating this object) as soon as `setValue`/`setValues`
   * touches that field — see the doc comment on `useFormFields` below. Passing a new object
   * here (e.g. from the next failed submit) makes every field's server error visible again.
   */
  readonly serverErrors?: Readonly<Record<string, string>>;
}

export interface UseFormFieldsResult {
  readonly values: Readonly<Record<string, FieldValue>>;
  setValue(name: string, value: FieldValue): void;
  /**
   * Applies several values in one commit — e.g. an extraction result covering multiple
   * attributes at once. Equivalent to calling `setValue` once per entry, but as a single state
   * update, and clearing every affected field's client error together.
   */
  setValues(partial: Readonly<Record<string, FieldValue>>): void;
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
 * `undefined` so they start as controlled inputs. For `boolean`, this bridge matches the legacy
 * app's own tri-state true/false/unset `BooleanField`
 * (contentgrid-navigator/src/components/form/components/BooleanField.tsx:24-25,35-39), seeding
 * `undefined` rather than `false` (see the doc comment on `isEmpty` below for why). Fields backed
 * by a non-native-input component (`relation-to-one`, `file`) also default to `undefined` —
 * `EntityPicker`/`FileUploadZone` don't need a placeholder value — and for every one of these
 * `undefined` doubles as "omit from `buildValues()`" for a field the user hasn't touched yet.
 */
function defaultValueFor(field: RenderFieldDescriptor): FieldValue {
  switch (field.type) {
    case "boolean":
      return undefined;
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
    values[field.name] = initialValues?.[field.name] ?? defaultValueFor(field);
  }
  return values;
}

/**
 * A `boolean` attribute can genuinely be unset (`null`) — `false` is a distinct, deliberate
 * value, not the absence of one. So a `boolean` field starts `undefined` (see `defaultValueFor`)
 * and only becomes `true`/`false` once the user interacts with its checkbox; `required` on a
 * boolean field therefore behaves like any other field, staying flagged until touched — matching
 * the server, whose "must have a value" constraint (per root CLAUDE.md's validation error list)
 * is likewise not "must be `true`". A checkbox that must be explicitly checked (e.g. terms
 * acceptance) is a product-level `allowed-values` constraint, not `required`, and would validate
 * through that path instead.
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

/** Required-field descriptors as (name, label) pairs. */
function requiredFieldEntries(
  fields: readonly RenderFieldDescriptor[],
): readonly { name: string; label: string }[] {
  return fields
    .filter((field) => field.required)
    .map((field) => ({ name: field.name, label: field.label }));
}

/**
 * Hand-rolled form-state hook (ADR-004's `useFormFields` direction — TanStack Form and React
 * Hook Form were both considered and rejected there: forms here are server-driven from
 * `RenderFieldDescriptor[]`, not user-defined schemas). Generalizes the value/dirty/validation state
 * that the legacy app managed via JSONForms + its own `CreateEntityInstance` component
 * (contentgrid-navigator/src/modules/CreateEntityInstance/components/CreateEntityInstance.tsx)
 * into a hook that operates on `RenderFieldDescriptor[]` instead of raw profile attributes, and
 * encodes via `createValues()` instead of hand-rolled number/date coercion.
 *
 * Values are stored already-typed (`HalFormsPropertyValue`), not as raw input strings — coercing
 * a native input event to the right JS type is the calling renderer's job (mirrors
 * `packages/features/src/search/filter-properties.ts`'s `coerceFilterValue`, which performs the
 * same coercion for FilterSidebar's inputs). This hook never imports from `packages/ui`; the
 * caller (a route or feature wrapper) reads `values`/`errors` and passes plain props down to
 * `packages/ui` renderers, the same boundary `SearchFilterProperty` already establishes.
 *
 * A field's `serverErrors` entry is dismissed as soon as the user edits that field — otherwise
 * a stale error (e.g. "already in use") keeps rendering after the user corrects it, right up
 * until the next submit produces a fresh `serverErrors` object. `dismissedServerErrorFields`
 * tracks which field names to hide from the current `serverErrors` object; it's reset (every
 * field becomes visible again) whenever the caller passes *different* server errors — detected
 * by content (`sameServerErrors`), not reference, using the render-time "adjust state when a
 * prop changes" pattern instead of a `useEffect`, so the reset is visible in the same render as
 * the new errors rather than one render later. Because the comparison is by content, a
 * resubmission landing the exact same message for the same field only counts as "new" once
 * `serverErrors` has visibly changed in between (e.g. cleared to `{}` before repopulating).
 */
export function useFormFields({
  fields,
  initialValues,
  serverErrors = EMPTY_SERVER_ERRORS,
}: UseFormFieldsOptions): UseFormFieldsResult {
  const [values, setValuesState] = useState<Record<string, FieldValue>>(() =>
    initializeValues(fields, initialValues),
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const initialValuesRef = useRef(values);

  const [dismissedServerErrorFields, setDismissedServerErrorFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [prevServerErrors, setPrevServerErrors] = useState(serverErrors);
  if (!sameServerErrors(serverErrors, prevServerErrors)) {
    setPrevServerErrors(serverErrors);
    setDismissedServerErrorFields(new Set());
  }

  function dismissServerErrors(names: readonly string[]) {
    setDismissedServerErrorFields((prev) => {
      const toAdd = names.filter((name) => !prev.has(name));
      if (toAdd.length === 0) return prev;
      const next = new Set(prev);
      for (const name of toAdd) next.add(name);
      return next;
    });
  }

  const requiredFields = useMemo(() => requiredFieldEntries(fields), [fields]);

  const isDirty = useMemo(
    () =>
      Object.keys(values).some(
        (name) => !valuesEqual(values[name], initialValuesRef.current[name]),
      ),
    [values],
  );

  function setValue(name: string, value: FieldValue) {
    setValuesState((prev) => ({ ...prev, [name]: value }));
    clearClientErrors([name]);
    dismissServerErrors([name]);
  }

  function setValues(partial: Readonly<Record<string, FieldValue>>) {
    setValuesState((prev) => ({ ...prev, ...partial }));
    clearClientErrors(Object.keys(partial));
    dismissServerErrors(Object.keys(partial));
  }

  function clearClientErrors(names: readonly string[]) {
    const toClear = names.filter((name) => clientErrors[name]);
    if (toClear.length === 0) return;
    setClientErrors((prev) => {
      const next = { ...prev };
      for (const name of toClear) delete next[name];
      return next;
    });
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
    setValuesState(initialValuesRef.current);
    setClientErrors({});
    setDismissedServerErrorFields(new Set());
  }

  const visibleServerErrors = Object.fromEntries(
    Object.entries(serverErrors).filter(([name]) => !dismissedServerErrorFields.has(name)),
  );

  return {
    values,
    setValue,
    setValues,
    // Client errors win over server errors for the same field — matches the prototype's
    // `validationErrors[name] ?? fieldErrors.find(...)` precedence.
    errors: { ...visibleServerErrors, ...clientErrors },
    isDirty,
    validate,
    buildValues,
    reset,
  };
}
