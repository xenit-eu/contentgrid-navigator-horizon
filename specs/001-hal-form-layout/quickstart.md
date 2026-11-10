# Quickstart: Generic HAL-Forms Field Renderer

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/hal-forms-public-api.md](./contracts/hal-forms-public-api.md)

Validation scenarios below map directly to the spec's user stories. Each is runnable
independently (matching each story's own "Independent Test"), without needing the others.

## Prerequisites

```bash
pnpm install
pnpm --filter @contentgrid/features exec tsc --noEmit
pnpm --filter @contentgrid/features run lint
```

The feature package (`packages/features/src/hal-forms/`) has its own `package.json` with
`"x-stability": "experimental"` — it is importable from `apps/navigator-experimental` but must
NOT be imported from `apps/navigator` (Constitution Principle IV; not enforced by tooling yet,
verify manually).

## US1 — Layout: two-column rows + omission

```bash
pnpm --filter @contentgrid/features exec vitest run src/hal-forms/model/resolve-hal-forms-fields.test.ts
```

**Expected**: a test supplying a `savedLayout` with one two-field row, one single-field row, and
one field omitted asserts (per spec Acceptance Scenarios 1–4):

- the two-field row's `fieldNames` are `[a, b]` in that order,
- the single-field row renders full width (`<HalFormsContainer>` snapshot/DOM test: no
  `grid-cols-2` class on that row),
- the omitted field's name never appears in `fields` looked up by any row,
- a duplicate-referenced field appears in only its first-listed row.

## US2 — Consistent validation (client + server)

```bash
pnpm --filter @contentgrid/features exec vitest run src/hal-forms/state/use-hal-forms-field-state.test.ts
```

**Expected**: one test clears a required field and asserts a client-sourced error appears without
any network call; a second test injects a server-shaped `FieldValidationError` (`source: "server"`)
via the state hook's external-error API and asserts it renders anchored to the same field; a third
changes the field to a valid value and asserts the error clears (Acceptance Scenarios 1–3).

## US3 — External fill and provenance

```bash
pnpm --filter @contentgrid/features exec vitest run src/hal-forms/state/field-provenance.test.ts
```

**Expected**: calling `setExternalValue(name, value, provenanceNode)` while the field is not
focused updates both value and `provenance`; calling it while `fieldState[name].isFocused` is
`true` is a no-op on the value (user's edit wins); a component test clicks the rendered provenance
indicator and asserts a `Popover` opens showing `provenanceNode`'s content; a field with no
`provenance` renders no indicator element at all (Acceptance Scenarios 1–4).

## US4 — Search form default layout pairs range fields

```bash
pnpm --filter @contentgrid/features exec vitest run src/hal-forms/model/generate-search-form-layout.test.ts
```

**Expected**: given a search template exposing both a `~before` and `~after` variant of one
property, `generateSearchFormLayout` returns one two-field row for that pair; given only one
variant, that property gets its own row; a test also asserts `resolveHalFormsFields` does NOT call
the generator when an explicit `savedLayout` is passed for a search template (Acceptance Scenarios
1–3).

## US5 — Autocomplete field kind

```bash
pnpm --filter @contentgrid/ui exec vitest run src/patterns/autocomplete-renderer.test.tsx
```

**Expected**: typing a partial value into the rendered `<AutocompleteRenderer>` calls
`onQueryChange` (debounced upstream by the feature layer, not this component); passing
`suggestions` renders them as selectable options; selecting one calls `onChange` with that value;
a field initialized with a value already set (from the user or from `setExternalValue`) shows that
value as the current selection (Acceptance Scenarios 1–2).

## End-to-end smoke check (manual, per Constitution's UI verification rule)

1. `pnpm --filter navigator-experimental dev`
2. Add a temporary demo route (or Storybook story) rendering `<HalFormsContainer>` against a
   fixture `CreateHalFormTemplate` AND a fixture `SearchHalFormTemplate` side by side.
3. Confirm: two-column rows render correctly on both; typing into a required field then clearing
   it shows a live error; an autocomplete field shows suggestions; a field with `provenance` set
   shows a clickable indicator that opens a popover.
4. Remove the temporary demo route/story before merging unless it's the deliberate Phase-1 story
   fixture kept for future manual QA.
