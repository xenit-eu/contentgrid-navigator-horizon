import type { FieldError } from "./field-error";

/**
 * Per-field state bag threaded from `useEntityItemCreateFormState` down through `FormContainer` to
 * `FieldRenderer`. Only carries `errors` today; this is the extension point for future
 * per-field data (e.g. an extraction feature's "this value was filled in by AI" annotation,
 * rendered by `FieldRenderer` as a tooltip alongside the field) without another prop/state
 * atom being threaded through the same call chain.
 */
export interface FieldState {
  readonly errors: readonly FieldError[];
}
