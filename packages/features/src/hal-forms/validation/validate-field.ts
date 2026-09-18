import type { FieldValue } from "@contentgrid/navigator-data";

/** Returns an error message for `value`, or `undefined` when it's valid. */
export type FieldValidator = (value: FieldValue) => string | undefined;

/**
 * A `boolean` attribute can genuinely be unset — `false` is a distinct, deliberate value, not
 * the absence of one — so emptiness is checked structurally, not by falsy-ness. Mirrors
 * `entity-item-create/state/use-entity-item-create-form-state.ts`'s `isEmpty`.
 */
function isEmpty(value: FieldValue): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Client-side validation entry point (FR-008): checks `value` against `required` (current
 * data) and/or an optional caller-supplied `validator` function, per the spec's own "current
 * data and/or a validation function" wording. `required` is checked first — a required, empty
 * field is invalid regardless of what a custom validator would say about an empty value.
 */
export function validateField(
  value: FieldValue,
  options: {
    readonly required: boolean;
    readonly label: string;
    readonly validator?: FieldValidator;
  },
): string | undefined {
  const { required, label, validator } = options;
  if (required && isEmpty(value)) return `${label} is required`;
  return validator?.(value);
}
