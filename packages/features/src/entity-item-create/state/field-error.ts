/**
 * Two-source error taxonomy replacing the old `Record<string, string>` shape from the retired
 * `useFormFields` (packages/navigator-data/src/form-fields/use-form-fields.ts):
 *
 * - `"internal"` — produced client-side by `use-entity-form-state.ts`'s own `validate()`
 *   (e.g. a required field left empty). Always wins over an external error for the same field
 *   (see `use-entity-form-state.ts`'s `errors` composition) — matches the old hook's
 *   client-errors-win-over-server-errors precedence.
 * - `"external"` — produced from a server response, via `to-field-errors.ts`'s
 *   `toFieldErrors(getValidationFieldErrors(error))`. Dismissed (hidden, not mutated) as soon as
 *   the user edits that field — same dismissal behaviour the old hook had for its
 *   `serverErrors` map.
 */
export interface FieldError {
  readonly source: "internal" | "external";
  readonly message: string;
  /** The raw problem `type` URI, when this error came from a typed validation problem. */
  readonly problemType?: string;
  /** The raw error entry, for a caller that needs more than `message` (e.g. `conflicting_item`). */
  readonly detail?: Record<string, unknown>;
}

/**
 * Per-field state bag threaded from `useEntityFormState` down through `FormContainer` to
 * `FieldRenderer`. Only carries `errors` today; this is the extension point for future
 * per-field data (e.g. an extraction feature's "this value was filled in by AI" annotation,
 * rendered by `FieldRenderer` as a tooltip alongside the field) without another prop/state
 * atom being threaded through the same call chain.
 */
export interface FieldState {
  readonly errors: readonly FieldError[];
}
