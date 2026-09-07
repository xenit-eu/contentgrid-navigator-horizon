import type { DefinedHalFormValue } from "@contentgrid/hal-forms/values";

/**
 * `DefinedHalFormValue["value"]` (not the wire-level `HalFormsPropertyValue`) — this is the
 * already-JS-typed value shape `HalFormValues.withValue()` actually accepts, including `Date`
 * for datetime fields and `File` for file uploads, neither of which the wire-level value type
 * carries.
 *
 * Lives here (rather than in a feature package) because it is fundamentally a
 * `@contentgrid/hal-forms`-derived type — `packages/ui` and `packages/features` are both
 * forbidden from importing `@contentgrid/hal-forms` directly (see their respective CLAUDE.md
 * forbidden-imports sections), so this type is re-exported from the package barrel the same way
 * `HalFormValues`/`createValues` already are.
 */
export type FieldValue = DefinedHalFormValue["value"] | undefined;
