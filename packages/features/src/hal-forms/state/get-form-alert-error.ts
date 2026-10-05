import { getValidationFieldErrors } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";

/**
 * The submit error to show in the alert above a form, or `undefined` when every part of it
 * renders inline on a field.
 *
 * A validation problem can contain entity-level errors with no `field` (e.g. a cross-field
 * constraint) alongside, or instead of, field-scoped ones. Those never render inline, so they
 * must always fall through to the alert — checking only "no field errors at all" would drop them
 * whenever the array is non-empty but contains an entry with no `field`.
 *
 * The same reasoning extends to a field-scoped error whose `field` doesn't match any rendered
 * field name (e.g. a system/audit field, or any property the form doesn't produce a field for) —
 * `toServerFieldErrors` buckets it under that field name, but no `HalFormsFieldRenderer` exists to
 * show it, and it also isn't a `field === undefined` entry, so without this check it would be
 * dropped by both paths and never reach the user.
 */
export function getFormAlertError(
  error: Error | null,
  fields: readonly HalFormsField[],
): Error | undefined {
  if (!error) return undefined;
  const knownFieldNames = new Set(fields.map((field) => field.name));
  const submitFieldErrors = getValidationFieldErrors(error);
  const hasNonFieldEntry =
    submitFieldErrors.length === 0 ||
    submitFieldErrors.some(
      (fieldError) => fieldError.field === undefined || !knownFieldNames.has(fieldError.field),
    );
  return hasNonFieldEntry ? error : undefined;
}
