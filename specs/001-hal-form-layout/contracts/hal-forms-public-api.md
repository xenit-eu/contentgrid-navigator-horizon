# Contract: `packages/features/src/hal-forms` public API

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

This is an internal library feature (no HTTP endpoint of its own) — its "contract" is the public
surface `index.ts` re-exports for consumers (any future call site building a create or search
form; today, exercised only by this feature's own tests/stories and, per Constitution Principle
IV, `apps/navigator-experimental` — `apps/navigator` cannot import an `experimental` feature).

## Exported functions

### `resolveHalFormsFields(template, savedLayout?)`

- **Input**: `template: CreateHalFormTemplate | SearchHalFormTemplate` (re-exported types from
  `@contentgrid/navigator-data`); `savedLayout?: readonly (readonly string[])[]`.
- **Output**: `{ fields: readonly HalFormsField[]; layout: LayoutSchema }`.
- **Errors**: none thrown — an unresolvable saved-layout reference is dropped (FR-007), never an
  exception. Pure function, no I/O.
- **Pre/postconditions**: every `layout.sections[].rows[].fieldNames` entry is guaranteed present
  in `fields` (FR-004/FR-007's reconciliation runs before this returns).

### `generateSearchFormLayout(searchTemplate, fields)`

- **Input**: `SearchHalFormTemplate`; `fields: readonly HalFormsField[]` — the already-resolved
  fields for this template (post redundancy suppression). Grouping runs over `fields`, not the
  raw template, so this never re-derives which properties survived — that decision is made once,
  in `resolveHalFormsFields`'s search-property mapping.
- **Output**: `LayoutSchema` (FR-018/019/020).
- **Errors**: none thrown. Pure function, no I/O.
- Called internally by `resolveHalFormsFields` when appropriate (FR-021) — also exported
  standalone so a caller can preview/inspect the generated default without invoking full field
  resolution.

## Exported components

### `<HalFormsContainer fields layout values onChange fieldState onFieldFocus? onFieldBlur? onExternalFill? />`

- Renders `layout.sections[].rows` exactly as `entity-item-create`'s `FormContainer` does today
  (one-field row full width, two-field row as a 2-col grid) — same rendering contract, generalized
  input.
- A section's optional `title`/`description` render as a header above its rows (FR-025/FR-026); a
  section with neither renders no header. A section with `isCollapsible: true` wraps its rows in
  a single toggle, defaulting to expanded, with the header (if any) doubling as the trigger
  (FR-027).
- Does not own a `<form>` tag or submit chrome (same split as `entity-item-create`'s
  `CreateEntityItemForm` vs. `FormContainer`) — a form-type-specific wrapper supplies it. Both the
  create-form and search-form paths now use this component directly (2026-09-18 amendments).

### `<HalFormsFieldRenderer field value onChange fieldState onFocus? onBlur? />`

- `kind`-dispatches to `packages/ui` renderers, extending `entity-item-create`'s existing
  `field-renderer.tsx` switch with one new case: `autocomplete` → the new `AutocompleteRenderer`
  (`packages/ui`).
- Renders `fieldState?.provenance` (if present) as a clickable indicator opening a `Popover`
  (FR-013/014) — provenance is read off the per-field state, NOT off `field` itself; it describes
  the current value's origin, which is runtime state, not part of the template-derived
  descriptor. Renders nothing for that slot when `fieldState?.provenance` is absent (FR-015).

## New `packages/ui` pattern: `<AutocompleteRenderer />`

- **Props** (plain, descriptor-agnostic, per `packages/ui/CLAUDE.md`): `name`, `label`, `required`,
  `readOnly`, `description?`, `value`, `onChange`, `error?`, `suggestions: readonly string[]`,
  `isLoading?: boolean`, `onQueryChange: (query: string) => void`.
- Mirrors `filter-sidebar.tsx`'s existing inline combobox (`Popover` + `Input` +
  `aria-autocomplete="list"` + arrow/enter/escape nav) as a reusable, standalone pattern — the
  feature layer (`packages/features/src/hal-forms`) is the one that calls `useTypeahead` and
  passes `suggestions`/`isLoading` down; `packages/ui` never imports `@contentgrid/navigator-data`.

## Not part of this contract (explicitly out of scope, FR-022)

- No change to `entity-item-create`'s or `search`'s exported APIs.
- No persistence API for `LayoutSchema` (no `setOverride`-style call) — this feature receives a
  layout schema as an input; saving one is the later, separate admin-editor effort the spec's
  Assumptions describe.
