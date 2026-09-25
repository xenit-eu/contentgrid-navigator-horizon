import type { DefinedHalFormValue } from "@contentgrid/hal-forms/values";

/**
 * `DefinedHalFormValue["value"]` (not the wire-level `HalFormsPropertyValue`) — this is the
 * already-JS-typed value shape `HalFormValues.withValue()` actually accepts, including `Date`
 * for datetime fields and `File` for file uploads, neither of which the wire-level value type
 * carries.
 *
 * Lives here (rather than in a feature package) because it is fundamentally a
 * `@contentgrid/hal-forms`-derived type — `packages/features` is forbidden from importing
 * `@contentgrid/hal-forms` directly (see its CLAUDE.md forbidden-imports section), so this type
 * is re-exported from the package barrel the same way `HalFormValues`/`createValues` already
 * are. `packages/ui`'s form renderers take plain value types instead; `packages/features`
 * narrows to them in `hal-forms/render/narrow-field-value.ts`.
 */
export type FieldValue = DefinedHalFormValue["value"] | undefined;

/**
 * `Record<string, FieldValue>`, named and exported the same way `@contentgrid/hal-forms/values`
 * names its own `HalFormValuesMap` (`Readonly<Record<string, DefinedHalFormValue["value"]>>`) —
 * deliberately not a re-export of `HalFormValuesMap` itself, since a field genuinely can be
 * `undefined` here (a required-but-untouched field, or a field kind whose empty state is
 * `undefined` rather than `""` — see `defaultValueFor` in
 * `packages/features/src/entity-item-create/state/use-entity-item-create-form-state.ts`), which
 * `HalFormValuesMap` deliberately excludes (a `HalFormValues` value manager only ever holds
 * defined values).
 */
export type FieldValueMap = Readonly<Record<string, FieldValue>>;
