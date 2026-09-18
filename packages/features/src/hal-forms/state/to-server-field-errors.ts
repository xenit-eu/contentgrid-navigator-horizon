import type { ValidationFieldError } from "@contentgrid/navigator-data";
import type { FieldValidationError } from "./field-error";

/**
 * Groups a validation problem's flat `errors[]` array (from
 * `getValidationFieldErrors(error)`) by `field`, converting each into a `"server"`
 * `FieldValidationError` for `useHalFormsFieldState`'s `externalErrors` option. Entity-level
 * errors (no `field`) are dropped — those never render inline; the caller surfaces them via its
 * own non-field alert path instead (mirrors `entity-item-create/state/to-field-errors.ts`'s
 * `toFieldErrors`, generalized so any `hal-forms` consumer — not just the create-form path — can
 * reuse it).
 */
export function toServerFieldErrors(
  errors: readonly ValidationFieldError[],
): Record<string, FieldValidationError[]> {
  const result: Record<string, FieldValidationError[]> = {};
  for (const error of errors) {
    if (error.field === undefined) continue;
    const fieldError: FieldValidationError = {
      source: "server",
      message: error.detail ?? error.title,
      validationFieldErrors: [error],
    };
    (result[error.field] ??= []).push(fieldError);
  }
  return result;
}
