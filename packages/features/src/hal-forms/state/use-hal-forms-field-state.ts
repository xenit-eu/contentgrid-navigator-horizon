import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  FieldValue,
  FieldValueMap,
  HalFormValues,
  HalFormsTemplate,
  TypedRequestSpec,
} from "@contentgrid/navigator-data";
import { createValues } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";
import type { FieldValidator } from "../validation/validate-field";
import { validateField } from "../validation/validate-field";
import type { FieldState, FieldValidationError } from "./field-error";
import { canApplyExternalValue } from "./field-provenance";

const EMPTY_EXTERNAL_ERRORS: Readonly<Record<string, readonly FieldValidationError[]>> = {};
const EMPTY_VALIDATORS: Readonly<Record<string, FieldValidator>> = {};

function haveEqualExternalErrorContent(
  a: Readonly<Record<string, readonly FieldValidationError[]>>,
  b: Readonly<Record<string, readonly FieldValidationError[]>>,
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

export interface UseHalFormsFieldStateOptions {
  readonly fields: readonly HalFormsField[];
  readonly initialValues?: FieldValueMap;
  /**
   * Per-field server-sourced errors, keyed by field name (FR-009) — dismissed (hidden, without
   * mutating this object) as soon as the user edits that field. Passing a new object here (e.g.
   * from the next failed submit) makes every field's external errors visible again.
   */
  readonly externalErrors?: Readonly<Record<string, readonly FieldValidationError[]>>;
  /** Optional per-field custom validation functions (FR-008's "... and/or a validation function"). */
  readonly fieldValidators?: Readonly<Record<string, FieldValidator>>;
}

export interface UseHalFormsFieldState {
  readonly values: FieldValueMap;
  setValue(name: string, value: FieldValue): void;
  /**
   * Applies several values in one commit — equivalent to calling `setValue` once per entry, but
   * as a single state update, and clearing every affected field's external error together.
   * Mirrors `entity-item-create`'s `useEntityItemCreateFormState.setValues` (FR-023 parity); has
   * no active caller in this codebase yet, same as that hook's own version.
   */
  setValues(partial: FieldValueMap): void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  readonly isDirty: boolean;
  touchField(name: string): void;
  /** Runs every field's client-side check; returns true when the form may be submitted. */
  validate(): boolean;
  /**
   * FR-011/FR-012: sets a field's value and provenance from an external caller (e.g. an
   * automation), UNLESS the field is currently focused — the user's in-progress edit wins and
   * this call is a no-op. `provenance` renders as a clickable indicator opening a popover
   * (FR-013/FR-014); omit it (or pass `undefined`) to leave the field's indicator unset.
   */
  setExternalValue(name: string, value: FieldValue, provenance?: ReactNode): void;
  /** Marks a field as currently being edited — call on focus. Gates `setExternalValue`. */
  focusField(name: string): void;
  /** Clears a field's focused state — call on blur. */
  blurField(name: string): void;
  /** Encodes the current values against a HAL-FORMS template. Empty/untouched fields are omitted. */
  buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec>;
  /** Resets values/touched/focused/provenance/dismissed-error state back to the initial values
   * this hook was seeded with. */
  reset(): void;
}

function defaultValueFor(field: HalFormsField): FieldValue {
  switch (field.kind) {
    case "boolean":
      return undefined;
    case "enum":
    case "autocomplete":
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
  fields: readonly HalFormsField[],
  initialValues: FieldValueMap | undefined,
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    values[field.name] = initialValues?.[field.name] ?? defaultValueFor(field);
  }
  return values;
}

/**
 * Array-valued fields (`enum`/`autocomplete` with `multiValue`) are always a freshly-built
 * array, so plain `!==` would report a field as dirty forever after it's touched, even once its
 * content matches the initial value again. Mirrors `entity-item-create`'s `valuesEqual`.
 */
function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/**
 * Generalizes `entity-item-create`'s `useEntityItemCreateFormState` (ADR-004) to
 * `HalFormsField[]`, per FR-008–FR-010: a field's error can come from a live client-side check
 * (required + an optional custom validator) or from server-sourced `externalErrors`; an
 * internal (client) error always wins over an external (server) one for the same field, and
 * clears live as soon as the value passes the check that produced it — no explicit
 * clear-on-edit step needed for internal errors. An external error IS explicitly dismissed as
 * soon as the user edits that field, the same way the create-form hook already does it.
 */
export function useHalFormsFieldState({
  fields,
  initialValues,
  externalErrors = EMPTY_EXTERNAL_ERRORS,
  fieldValidators = EMPTY_VALIDATORS,
}: UseHalFormsFieldStateOptions): UseHalFormsFieldState {
  const [values, setValuesState] = useState<Record<string, FieldValue>>(() =>
    initializeValues(fields, initialValues),
  );
  const initialValuesRef = useRef(values);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [focusedFields, setFocusedFields] = useState<Set<string>>(() => new Set());
  const [provenanceByField, setProvenanceByField] = useState<Record<string, ReactNode>>({});

  const [dismissedExternalErrorFields, setDismissedExternalErrorFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [prevExternalErrors, setPrevExternalErrors] = useState(externalErrors);
  if (!haveEqualExternalErrorContent(externalErrors, prevExternalErrors)) {
    setPrevExternalErrors(externalErrors);
    setDismissedExternalErrorFields(new Set());
  }

  const dismissExternalError = useCallback((name: string) => {
    setDismissedExternalErrorFields((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  }, []);

  const isDirty = useMemo(
    () =>
      Object.keys(values).some(
        (name) => !valuesEqual(values[name], initialValuesRef.current[name]),
      ),
    [values],
  );

  const setValue = useCallback(
    (name: string, value: FieldValue) => {
      setValuesState((prev) => ({ ...prev, [name]: value }));
      dismissExternalError(name);
    },
    [dismissExternalError],
  );

  const setValues = useCallback(
    (partial: FieldValueMap) => {
      setValuesState((prev) => ({ ...prev, ...partial }));
      Object.keys(partial).forEach(dismissExternalError);
    },
    [dismissExternalError],
  );

  const touchField = useCallback((name: string) => {
    setTouchedFields((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  }, []);

  const focusField = useCallback((name: string) => {
    setFocusedFields((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  }, []);

  const blurField = useCallback((name: string) => {
    setFocusedFields((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const setExternalValue = useCallback(
    (name: string, value: FieldValue, provenance?: ReactNode) => {
      if (!canApplyExternalValue(focusedFields.has(name))) return;
      setValuesState((prev) => ({ ...prev, [name]: value }));
      dismissExternalError(name);
      setProvenanceByField((prev) => ({ ...prev, [name]: provenance }));
    },
    [focusedFields, dismissExternalError],
  );

  function fieldClientError(field: HalFormsField): string | undefined {
    return validateField(values[field.name], {
      required: field.required,
      label: field.label,
      validator: fieldValidators[field.name],
    });
  }

  function validate(): boolean {
    setTouchedFields(new Set(fields.map((field) => field.name)));
    return fields.every((field) => fieldClientError(field) === undefined);
  }

  function buildValues<Spec extends TypedRequestSpec<unknown, unknown>>(
    template: HalFormsTemplate<Spec>,
  ): HalFormValues<Spec> {
    return Object.entries(values).reduce((vals, [name, value]) => {
      if (value === undefined || value === "") return vals;
      // Also omit an empty array (the seeded default for an untouched multi-value field) — the
      // HAL-FORMS codec rejects an empty list for a multi-value property outright, so an
      // untouched one must be omitted, not sent. Mirrors entity-item-create's buildValues.
      if (Array.isArray(value) && value.length === 0) return vals;
      return vals.withValue(name, value);
    }, createValues(template));
  }

  function reset() {
    setValuesState(initialValuesRef.current);
    setTouchedFields(new Set());
    setFocusedFields(new Set());
    setProvenanceByField({});
    setDismissedExternalErrorFields(new Set());
  }

  const fieldState: Record<string, FieldState> = {};
  for (const [name, errors] of Object.entries(externalErrors)) {
    if (!dismissedExternalErrorFields.has(name) && errors.length > 0) {
      fieldState[name] = { errors };
    }
  }
  // An internal (client-side) error wins over an external (server-side) one for the same
  // touched field. A field with no current internal error simply isn't touched here — external
  // error dismissal is handled separately, by `setValue`, not by merely touching/blurring a
  // field (blurring without editing must never silently dismiss a server-reported error).
  for (const field of fields) {
    if (!touchedFields.has(field.name)) continue;
    const message = fieldClientError(field);
    if (message) fieldState[field.name] = { errors: [{ source: "client", message }] };
  }
  // Provenance merges on top regardless of error state — a field can show both an error and
  // where its (invalid) value came from, or provenance with no error at all.
  for (const [name, provenance] of Object.entries(provenanceByField)) {
    if (provenance === undefined) continue;
    fieldState[name] = { errors: fieldState[name]?.errors ?? [], provenance };
  }

  return {
    values,
    setValue,
    setValues,
    fieldState,
    isDirty,
    touchField,
    validate,
    setExternalValue,
    focusField,
    blurField,
    buildValues,
    reset,
  };
}
