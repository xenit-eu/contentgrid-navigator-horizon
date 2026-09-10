import { useMemo, useRef, useState } from "react";
import type {
  FieldValue,
  FieldValueMap,
  HalFormValues,
  HalFormsTemplate,
  TypedRequestSpec,
} from "@contentgrid/navigator-data";
import { createValues } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import type { FieldError } from "./field-error";
import type { FieldState } from "./field-state";

/**
 * Stable shared reference for the `externalErrors` default — avoids allocating a fresh `{}` on
 * every render for the common "no external errors" case. Not load-bearing for correctness (the
 * dismissal-reset logic below compares `externalErrors` by *content*, not reference — see
 * `haveEqualExternalErrorContent`), but a default parameter expression is otherwise re-evaluated on every
 * call, so this is a cheap avoidance of needless allocation.
 */
const EMPTY_EXTERNAL_ERRORS: Readonly<Record<string, readonly FieldError[]>> = {};

/**
 * Shallow content equality for two field-name-keyed `FieldError[]` maps. Deliberately NOT a
 * reference (`!==`) check: a caller that passes an inline object literal for `externalErrors`
 * (as many will, and as this hook's own tests do) creates a new object every render even when
 * nothing about the errors actually changed — reference comparison would treat that as "a new
 * error map arrived" on every single render and reset the dismissal tracking every time, which
 * for the specific comparison below (guarding a render-phase `setState` call) is an infinite
 * re-render loop, not just a correctness bug.
 */
function haveEqualExternalErrorContent(
  a: Readonly<Record<string, readonly FieldError[]>>,
  b: Readonly<Record<string, readonly FieldError[]>>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => {
    const aErrors = a[key] ?? [];
    const bErrors = b[key] ?? [];
    if (aErrors.length !== bErrors.length) return false;
    return aErrors.every(
      (error, index) =>
        error.source === bErrors[index]?.source && error.message === bErrors[index]?.message,
    );
  });
}

export interface UseEntityItemCreateFormStateOptions {
  readonly fields: readonly FieldDescriptor[];
  /** Existing values, keyed by property name (edit mode). Omitted fields start at a type-appropriate empty value. */
  readonly initialValues?: FieldValueMap;
  /**
   * Per-field server-sourced errors, keyed by property name — typically the output of
   * `toFieldErrors(getValidationFieldErrors(error))` after a failed submit. A field's external
   * errors are dismissed (hidden from `errors`, without mutating this object) as soon as
   * `setValue`/`setValues` touches that field — see the doc comment on `useEntityItemCreateFormState`
   * below. Passing a new object here (e.g. from the next failed submit) makes every field's
   * external errors visible again.
   */
  readonly externalErrors?: Readonly<Record<string, readonly FieldError[]>>;
}

export interface UseEntityItemCreateFormState {
  readonly values: FieldValueMap;
  setValue(name: string, value: FieldValue): void;
  /**
   * Applies several values in one commit — used by `create-entity-item-container.tsx`'s
   * `onApplyAllAnnotations` to apply every annotated field's extracted value at once. Equivalent
   * to calling `setValue` once per entry, but as a single state update, and clearing every
   * affected field's internal error together.
   */
  setValues(partial: FieldValueMap): void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly isDirty: boolean;
  /**
   * Marks one field as touched — call on blur. A touched, required, still-empty field shows its
   * "is required" error immediately, without waiting for a submit attempt. Matches legacy
   * Navigator's per-field `isTouched` gating in `FormControlRenderer`
   * (contentgrid-navigator/src/components/form/Form.tsx) — don't flash a required error before
   * the user has had a chance to fill the field in, but do show it as soon as they've visited and
   * left it empty.
   */
  touchField(name: string): void;
  /**
   * Runs client-side required-field validation; returns true when the form may be submitted.
   * Also marks every field touched, so a submit attempt reveals every remaining required-empty
   * field's error, not just the ones the user has individually blurred.
   */
  validate(): boolean;
  /** Encodes the current values against a HAL-FORMS template. Empty/untouched fields are omitted. */
  buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec>;
  reset(): void;
}

/**
 * A field's initial value when none was supplied. Text-like fields default to `""` rather than
 * `undefined` so they start as controlled inputs. `boolean` seeds `undefined` rather than
 * `false` — a boolean attribute can genuinely be unset (see `isEmpty`'s doc comment below),
 * matching the legacy app's own tri-state true/false/unset `BooleanField`
 * (contentgrid-navigator/src/components/form/components/BooleanField.tsx:24-25,35-39). Fields
 * backed by a non-native-input component (`relation` to-one, `file`) also default to
 * `undefined` — for every one of these `undefined` doubles as "omit from `buildValues()`" for a
 * field the user hasn't touched yet.
 */
function defaultValueFor(field: FieldDescriptor): FieldValue {
  switch (field.kind) {
    case "boolean":
      return undefined;
    case "relation":
      return field.cardinality === "to-many" ? [] : undefined;
    case "enum":
      return field.multiValue ? [] : "";
    case "file":
      return undefined;
    case "text":
    case "number":
    case "datetime":
      return "";
  }
}

function initializeValues(
  fields: readonly FieldDescriptor[],
  initialValues: FieldValueMap | undefined,
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
 * boolean field therefore behaves like any other field, staying flagged until touched.
 */
function isEmpty(value: FieldValue): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Array-valued fields (`enum` with `multiValue`, `relation` to-many) are always a freshly-built
 * array — e.g. unlinking a relation produces a new `[]` — so plain `!==` would report a field as
 * dirty forever after it's touched, even once its content matches the initial value again.
 */
function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/** Required-field descriptors as (name, label) pairs. */
function requiredFieldEntries(
  fields: readonly FieldDescriptor[],
): readonly { name: string; label: string }[] {
  return fields
    .filter((field) => field.required)
    .map((field) => ({ name: field.name, label: field.label }));
}

/**
 * Hand-rolled form-state hook operating on `FieldDescriptor[]`/`FieldError[]` (ADR-004's
 * `useFormFields` direction, carried forward by this restructure) — a direct replacement for the
 * retired `packages/navigator-data/src/form-fields/use-form-fields.ts`'s `useFormFields`, ported
 * to the new model/state types rather than reimplemented from scratch.
 *
 * Values are stored already-typed (`FieldValue`, i.e. `HalFormsPropertyValue`), not as raw input
 * strings — coercing a native input event to the right JS type is the calling renderer's job.
 * This hook never imports from `@contentgrid/ui`; the caller (`create-entity-item-form.tsx`)
 * reads `values`/`errors` and passes plain props down to `@contentgrid/ui` renderers via
 * `render/field-renderer.tsx`.
 *
 * A field's `externalErrors` entry is dismissed as soon as the user edits that field —
 * otherwise a stale error (e.g. "already in use") keeps rendering after the user corrects it,
 * right up until the next submit produces a fresh `externalErrors` object.
 * `dismissedExternalErrorFields` tracks which field names to hide from the current
 * `externalErrors` object; it's reset (every field becomes visible again) whenever the caller
 * passes *different* external errors — detected by content (`haveEqualExternalErrorContent`), not
 * reference, using the render-time "adjust state when a prop changes" pattern instead of a
 * `useEffect`, so the reset is visible in the same render as the new errors rather than one
 * render later.
 *
 * A required field's "internal" error is derived live from `touchedFields` + the current
 * `values` on every render (not stored separately) — as soon as a touched field becomes
 * non-empty the error disappears on its own, and as soon as it's emptied again (while still
 * touched) it reappears, with no explicit clear-on-edit step needed the way external errors need
 * `dismissExternalErrors`.
 */
export function useEntityItemCreateFormState({
  fields,
  initialValues,
  externalErrors = EMPTY_EXTERNAL_ERRORS,
}: UseEntityItemCreateFormStateOptions): UseEntityItemCreateFormState {
  const [values, setValuesState] = useState<Record<string, FieldValue>>(() =>
    initializeValues(fields, initialValues),
  );
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const initialValuesRef = useRef(values);

  const [dismissedExternalErrorFields, setDismissedExternalErrorFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [prevExternalErrors, setPrevExternalErrors] = useState(externalErrors);
  if (!haveEqualExternalErrorContent(externalErrors, prevExternalErrors)) {
    setPrevExternalErrors(externalErrors);
    setDismissedExternalErrorFields(new Set());
  }

  function dismissExternalErrors(names: readonly string[]) {
    setDismissedExternalErrorFields((prev) => {
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
    dismissExternalErrors([name]);
  }

  function setValues(partial: FieldValueMap) {
    setValuesState((prev) => ({ ...prev, ...partial }));
    dismissExternalErrors(Object.keys(partial));
  }

  function touchField(name: string) {
    setTouchedFields((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }

  function validate(): boolean {
    setTouchedFields(new Set(fields.map((field) => field.name)));
    return requiredFields.every(({ name }) => !isEmpty(values[name]));
  }

  function buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec> {
    return Object.entries(values).reduce((vals, [name, value]) => {
      if (value === undefined || value === "") return vals;
      // Also omit an empty array (the seeded default for an untouched multi-value enum /
      // to-many relation field, mirroring isEmpty()'s array case above) — the HAL-FORMS codec
      // rejects an empty list for a multi-value property outright, so an untouched one must be
      // omitted, not sent.
      if (Array.isArray(value) && value.length === 0) return vals;
      return vals.withValue(name, value);
    }, createValues(template));
  }

  function reset() {
    setValuesState(initialValuesRef.current);
    setTouchedFields(new Set());
    setDismissedExternalErrorFields(new Set());
  }

  const fieldState: Record<string, FieldState> = {};
  for (const [name, fieldExternalErrors] of Object.entries(externalErrors)) {
    if (!dismissedExternalErrorFields.has(name) && fieldExternalErrors.length > 0) {
      fieldState[name] = { errors: fieldExternalErrors };
    }
  }
  // Internal (client-side) errors win over external (server-side) ones for the same field —
  // matches the retired hook's `{ ...visibleServerErrors, ...clientErrors }` precedence. Only
  // shown for a touched field (see `touchField`'s doc comment above).
  for (const { name, label } of requiredFields) {
    if (touchedFields.has(name) && isEmpty(values[name])) {
      fieldState[name] = { errors: [{ source: "internal", message: `${label} is required` }] };
    }
  }

  return {
    values,
    setValue,
    setValues,
    touchField,
    fieldState,
    isDirty,
    validate,
    buildValues,
    reset,
  };
}
