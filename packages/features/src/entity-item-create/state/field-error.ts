import type { ValidationFieldError } from "@contentgrid/navigator-data";

/**
 * Two-source error taxonomy replacing the old `Record<string, string>` shape from the retired
 * `useFormFields` (packages/navigator-data/src/form-fields/use-form-fields.ts):
 *
 * - `"internal"` — produced client-side by `use-entity-item-create-form-state.ts`'s own `validate()`
 *   (e.g. a required field left empty). Always wins over an external error for the same field
 *   (see `use-entity-item-create-form-state.ts`'s `errors` composition) — matches the old hook's
 *   client-errors-win-over-server-errors precedence.
 * - `"external"` — produced from a server response, via `to-field-errors.ts`'s
 *   `toFieldErrors(getValidationFieldErrors(error))`. Dismissed (hidden, not mutated) as soon as
 *   the user edits that field — same dismissal behaviour the old hook had for its
 *   `serverErrors` map.
 */
export interface FieldError {
  readonly source: "internal" | "external";
  readonly message: string;
  /**
   * The complete typed problem entry, for a caller that needs more than `message` — e.g. the
   * `type` discriminant, or a variant-specific field like `conflicting_item`/`allowed_values`.
   * Only set for `"external"` errors.
   */
  readonly problemDetail?: ValidationFieldError;
}
