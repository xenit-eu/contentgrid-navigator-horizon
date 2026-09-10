import type { ValidationFieldError } from "@contentgrid/navigator-data";
import type { FieldError } from "./field-error";

/**
 * Groups a validation problem's flat `errors[]` array (from
 * `getValidationFieldErrors(error)`) by `field`, converting each into an `external`
 * `FieldError`. Entity-level errors (no `field`) are dropped — those never render inline; the
 * caller (`create-entity-item-container.tsx`) surfaces them via the existing non-field
 * `ProblemAlert` path instead, same as before this restructure.
 */
export function toFieldErrors(
  errors: readonly ValidationFieldError[],
): Record<string, FieldError[]> {
  const result: Record<string, FieldError[]> = {};
  for (const error of errors) {
    if (error.field === undefined) continue;
    const fieldError: FieldError = {
      source: "external",
      message: error.detail ?? error.title,
      problemDetail: error,
    };
    (result[error.field] ??= []).push(fieldError);
  }
  return result;
}
