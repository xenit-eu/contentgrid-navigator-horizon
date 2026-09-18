import type { ReactNode } from "react";
import type { ValidationFieldError } from "@contentgrid/navigator-data";

/**
 * A field-scoped validation message, sourced from either a live client-side check or a problem
 * response returned by the server after submission (FR-008/FR-009). Mirrors
 * `entity-item-create/state/field-error.ts`'s `FieldError` shape — same two-source model
 * (renamed `"internal"/"external"` → `"client"/"server"` to match the spec's own wording:
 * FR-008's "client-side check", FR-009's "server's response") — reused rather than redesigned.
 */
export interface FieldValidationError {
  readonly source: "client" | "server";
  readonly message: string;
  /**
   * The complete typed validation entries this error was built from, for a caller that needs
   * more than `message` — e.g. the `type` discriminant, or a variant-specific field like
   * `conflicting_item`/`allowed_values`. Only set for a `"server"` error. Mirrors
   * `entity-item-create/state/field-error.ts`'s `FieldError.validationFieldErrors` (FR-023
   * parity) — carried through unread by this feature itself, same as that original field is
   * today, for whichever caller needs it.
   */
  readonly validationFieldErrors?: readonly ValidationFieldError[];
}

/**
 * Live suggestion data for one `autocomplete` field (FR-017), supplied by whichever caller has
 * the profile/template context to run `useTypeahead` (`@contentgrid/navigator-data`) — this
 * feature's own render layer never calls it directly, mirroring `packages/ui`'s
 * `AutocompleteRenderer` taking only plain scalar props. Lives on `FieldState`, not on
 * `HalFormsField`, for the same reason `provenance` does: it's runtime data the field's static,
 * template-derived shape has no way to carry.
 */
export interface FieldAutocompleteState {
  readonly suggestions: readonly string[];
  readonly isLoading?: boolean;
  readonly onQueryChange: (query: string) => void;
}

/**
 * One entry of `useHalFormsFieldState`'s returned `fieldState`, keyed by field name.
 *
 * `provenance` and `autocomplete` deliberately live here, not on `HalFormsField` — both describe
 * runtime state that changes independently of the template-derived field shape. `provenance`
 * `undefined` means the renderer shows no provenance indicator at all for this field (FR-015);
 * `autocomplete` `undefined` on an `autocomplete`-kind field means no suggestion source has been
 * wired up yet, and the field renders as an inert placeholder rather than a broken combobox. See
 * `model/hal-forms-field.ts`'s doc comment for the full provenance rationale.
 */
export interface FieldState {
  readonly errors: readonly FieldValidationError[];
  readonly provenance?: ReactNode;
  readonly autocomplete?: FieldAutocompleteState;
}
