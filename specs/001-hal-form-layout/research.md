# Research: Generic HAL-Forms Field Renderer

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-18

No `NEEDS CLARIFICATION` markers remain in Technical Context (see `plan.md`) — the spec's own
clarification session already resolved the three open questions that would otherwise have
generated research tasks here. This document instead grounds the plan's technical decisions in
the two existing mechanisms this feature must reach parity with (FR-023), and records one
decision that knowingly supersedes prior in-code guidance.

## Decision: where the two existing mechanisms actually live today

**Create-form path** (`packages/features/src/entity-item-create/`, `x-stability: "stable"`):

- `model/field-descriptor.ts` — `FieldDescriptor`, a `kind`-discriminated union (`text`, `number`,
  `datetime`, `boolean`, `file`, `enum`), each carrying the raw `HalFormsProperty`.
- `model/resolve-create-field-descriptors.ts` — pure bridge: `CreateHalFormTemplate` →
  `{ fields, layout }`. Already extended (this session, since reverted on disk but re-derivable)
  to accept an optional `savedLayout: readonly (readonly string[])[]` and reconcile it against
  `fields` — dropping stale references and deduplicating repeated ones. Its one behavior this
  feature does NOT carry over: it auto-appends a field the saved layout never mentions as its own
  row, whereas this spec's FR-004 requires the opposite — an unreferenced field must be omitted
  entirely (a deliberate, explicit requirement from the feature's input, not an oversight). The
  stale-reference-dropping and duplicate-handling halves of the existing logic are still the
  direct model for FR-006/FR-007/FR-020; the append-unreferenced-fields half is not.
- `model/layout-information.ts` — `LayoutInformation { groups: readonly FieldGroup[] }`,
  `FieldGroup { title?, rows: readonly (readonly string[])[] }`. This is the exact shape the spec's
  Key Entities section describes as "Layout schema" — already built to hold 1-or-2-field rows.
- `render/form-container.tsx` — walks `layout.groups[].rows`, rendering a 2-col grid for a
  two-field row and a plain full-width block for a one-field row.
- `render/field-renderer.tsx` — the `kind` switch dispatching to `packages/ui`'s descriptor-agnostic
  renderers (`TextRenderer`, `NumberRenderer`, `BooleanRenderer`, `DateTimeRenderer`,
  `EnumRenderer`/`EnumMultiRenderer`); `file` is currently an inert placeholder.
- `state/use-entity-item-create-form-state.ts` — per-field touched/value/error state, with
  `validate()` (client-side) and external-error injection (server-side, mapped via
  `toFieldErrors(getValidationFieldErrors(error))`). This dual client/server error path is the
  direct model for FR-008/FR-009/FR-010.
- No provenance concept exists today. No external-fill concept exists today. No `autocomplete`
  `FieldDescriptor` kind exists today.

**Search-form path** (`packages/features/src/search/filter-properties.ts` +
`packages/ui/src/patterns/filter-sidebar/filter-sidebar.tsx`, both `x-stability: "stable"`):

- A **completely different** view model: `SearchFilterProperty` (`packages/ui`) — flat, with
  `groupKey`/`groupLabel`/`searchOperator`/`directionLabel`, no `kind` union at all
  (`inputKind: "text" | "number" | "date" | "datetime" | "boolean" | "select"`).
  `buildFilterProperties()` computes `groupKey` per attribute and already suppresses a redundant
  sibling (`isRedundantExactMatch`, `isRedundantStrictRangeBound`) so only the useful range
  operators survive.
- **The `~before`/`~after` pairing FR-018/019/020 need already half-exists**, just not as a layout
  schema: `directionLabel` (`"After" | "Before" | "From" | "Until"`) is computed per property, and
  every direction-labeled property sharing one `groupKey` is already the exact set FR-019 needs
  to place on one row. `computeDirectionLabel`'s mapping (`greater-than` → `After`, etc.) is the
  ready-made input to a `groupKey`-keyed row generator.
- The autocomplete behavior FR-017/US5 references already exists here as inline UI
  (`TypeaheadTextFilter` in `filter-sidebar.tsx`): a `Popover` + `Input` combobox with
  `aria-autocomplete="list"`, keyboard nav (arrow/enter/escape), driven by suggestions supplied
  from _outside_ `packages/ui` — `activeTypeaheadField` / `typeaheadSuggestions` /
  `typeaheadIsLoading` props, populated by `useTypeahead` (`@contentgrid/navigator-data`) at the
  feature layer (`entity-item-collection-view.tsx`), never imported into `packages/ui` itself.
  This external-suggestions boundary is the model for the new `AutocompleteRenderer`.
- No client/server validation display exists on the search form at all today (filters are opportunistic,
  not validated the way a create submission is) — `findInvalidFilterKeys` only flags a
  coercion failure, shown as a single message, not a structured field-level validation error.

**Decision**: the plan builds one new, standalone feature (`packages/features/src/hal-forms/`,
`x-stability: "experimental"`) that generalizes the create-form path's shapes (`FieldDescriptor` →
a broader per-field model; `LayoutInformation`/rows unchanged in shape) to also describe a search
form, rather than growing either existing stable feature in place. Per Constitution Principle IV,
a `stable` feature cannot import an `experimental` one — so this is also the only path available
without either prematurely stabilizing the new renderer or modifying `entity-item-create`/`search`
in this pass, both explicitly out of scope per FR-022.

**Alternatives considered**:

- Extend `entity-item-create`'s existing `FieldDescriptor`/`resolveCreateFieldDescriptors` in place
  to also accept a `SearchHalFormTemplate`. Rejected: that would require migrating
  `filter-properties.ts`/`FilterSidebar` in the same pass to consume the new shape, which FR-022
  explicitly places out of scope, and would touch a `stable` feature for functionality most of
  which (provenance, external fill, autocomplete) isn't validated yet.
- Keep validation/provenance/external-fill as three separate ad hoc additions to the existing
  create-form state hook. Rejected: none of the three are create-form-specific: FR-002 requires
  identical behavior on both form types, so they belong in the new shared model, not bolted onto
  a form-specific hook.

## Decision: superseding `field-descriptor.ts`'s "no future migration" comment

`packages/features/src/entity-item-create/model/field-descriptor.ts`'s doc comment states, about
why `filter`/`sort` aren't members of its `FieldDescriptor` union:

> "Filtering already has a real, working, differently-shaped home ... There is no future
> migration that would route filter fields through this type instead."

This spec's FR-001/FR-002 (one generic renderer behind both create and search) is a direct,
intentional reversal of that stance — not an oversight. It is safe to proceed despite the
comment because:

1. This plan does **not** touch `field-descriptor.ts` or route search through it — it introduces
   a **new**, separate model in `packages/features/src/hal-forms/`, leaving the comment's literal
   claim (about _that_ type) true.
2. The comment's rationale — "no future migration... a second, guessed-shape, unused
   implementation of something already solved" — was written before this feature's clarified
   scope existed (a real, spec-driven unification, not a guess) and before FR-023's parity
   requirement existed to keep it from becoming "unused."
3. A follow-up task (outside this plan, since migration is out of scope per FR-022) should update
   or remove that comment once `entity-item-create`/`search` are actually migrated onto the new
   renderer — recorded here so it isn't lost.

**Alternatives considered**: leaving the two mechanisms permanently separate and only unifying
provenance/external-fill/autocomplete as parallel, duplicated implementations. Rejected: this is
exactly the inconsistency the spec's User Story 2 (P1) and SC-001 identify as the core problem to
remove — duplicating the fix defeats the feature's own success criteria.

## Decision: provenance and its popover are a rendering slot, not a fixed enum

Per the spec's clarification, FR-013/FR-014 require an extensible, caller-supplied rendering
mechanism, not a closed set of states. Concretely: a field descriptor carries an optional
`provenance?: ReactNode` (or an equivalent renderable value) rather than a
`provenanceState: "user" | "automation" | "original"` enum. The indicator wraps that content in a
clickable trigger opening a `Popover` (`packages/ui`'s existing primitive, already used by
`filter-sidebar.tsx`'s combobox) showing the same content. A field with `provenance` absent/`null`
renders no indicator at all (FR-015).

**Alternatives considered**: a fixed provenance-state enum with a switch-rendered icon per state.
Rejected per the clarification answer — the caller (whoever fills the field, e.g. a future
automation integration) needs to supply arbitrary explanatory content (which automation, when,
why), which a closed enum can't express without constantly growing.

## Decision: the search-form default layout is a generator function producing an ordinary layout schema

Per the spec's clarification, FR-018/019/020 require the `~before`/`~after` pairing to be
expressed as an ordinary `LayoutInformation`/rows structure, produced by a dedicated, callable
generation step — not a special-cased rendering branch. Concretely: a pure function
`generateSearchFormLayout(searchTemplate): LayoutInformation` groups the template's search
properties by `groupKey` (reusing `computeDirectionLabel`'s "After/Before/From/Until" classification
from `filter-properties.ts` as its input) and emits one two-field row per `groupKey` with two
direction-labeled siblings, one single-field row for every other property. The renderer calls this
only when no explicit layout schema was supplied for that search form (FR-021); when one was, it's
used as-is, with the same reconciliation (FR-006/FR-007) as any other layout schema.

**Alternatives considered**: hardcoding the pairing check as a rendering-time special case (e.g. "if
this field's `directionLabel` is set, look for a sibling"). Rejected per the clarification answer
— the user explicitly wants this NOT to be a separate rule, precisely so every other layout
requirement (row cap, ordering, omission, duplicate handling) automatically applies to it too, with
no parallel code path to keep in sync.

## Decision: autocomplete field kind reuses `useTypeahead`, no new data-fetching mechanism

FR-017/US5 add an `autocomplete` field kind. Data fetching stays exactly where
`packages/ui/CLAUDE.md` already requires it: `useTypeahead` (`@contentgrid/navigator-data`) is
called at the `packages/features/src/hal-forms/` layer, never inside the new `packages/ui`
`AutocompleteRenderer`, which takes only plain scalar props (`value`, `onChange`, `suggestions`,
`isLoading`, `onQueryChange`) — mirroring `filter-sidebar.tsx`'s existing
`activeTypeaheadField`/`typeaheadSuggestions`/`typeaheadIsLoading` contract exactly, rather than
inventing a new one.

**Alternatives considered**: giving every autocomplete field its own independent `useTypeahead`
call. Rejected, matching the existing filter-sidebar comment ("only one query active at a time")
— multiple concurrent typeahead queries per form is unnecessary complexity this feature doesn't
need to introduce.

**Confirmed during implementation, by the real migration**: `resolveHalFormsFields`'s search
path auto-classifies a prefix-match/full-text property as `kind: "autocomplete"` (no opt-in
needed there, unlike the create path — every such search property already gets this behavior
today) and attaches a `searchContext` (`{ profileEntity, searchProperty }`, resolved once) so a
caller doesn't have to re-derive the `SearchHalFormTemplateProperty` lookup itself. An earlier
detour tried calling `useTypeahead` directly inside `HalFormsFieldRenderer`'s `autocomplete`
case using that context — reverted per explicit direction: "the search page must do the
`useTypeahead` call and pass the values to the input field," i.e. this render layer must stay as
uniformly non-fetching for `autocomplete` as it already is for every other kind. The real
migration (`entity-item-collection-view.tsx`, see the next decision) is the proof: it keeps its
own `activeTypeaheadField`/`useTypeahead` exactly as before and feeds results into
`fieldState[name].autocomplete`, unchanged in spirit from what `FilterSidebar` received via
`typeaheadSuggestions`/`typeaheadIsLoading` props.

## Decision: the real search-form UI now renders through this feature (amendment, 2026-09-18)

FR-022 (via the spec's clarification) originally scoped this feature to standalone delivery —
no migration of `entity-item-create`/`search`. That held until explicit direction mid-implementation:
migrate `entity-item-collection-view.tsx`'s search-filter dialog from `FilterSidebar`
(`@contentgrid/ui`) onto `HalFormsContainer`, deprecating `FilterSidebar` for that call site (not
deleting it — nothing else was asked to remove it, and no other call site was touched).

This required two changes beyond the original plan:

1. **`hal-forms` promoted `experimental` → `stable`.** `entity-item-collection` (the view's own
   feature) is `stable`; Constitution Principle IV forbids a `stable` feature importing an
   `experimental` one. The dependency graph check (per `packages/features/CLAUDE.md`'s promotion
   workflow) was clean — `hal-forms` has no feature-level dependencies, only `navigator-data`/`ui`
   — so promotion, not a documented exception, resolved this.
2. **`SearchHalFormTemplate.profileEntity` made public** (`packages/navigator-data`, one-word
   change: `private readonly` → `public readonly` on the existing constructor parameter property;
   every internal `this.profileEntity` usage is unaffected). Needed so a `HalFormsField`'s
   `searchContext` can carry the profile alongside the search property — `useTypeahead` requires
   both, and nothing previously exposed this template's profile back out.

**What did NOT change**: `filter-properties.ts`'s `buildFilterProperties`/`coerceFilterValue`/
`applyFilterValues`/`findInvalidFilterKeys`/`extractFilterValuesFromCollectionUrl`/
`findActivelyFilteredAttributeNames` remain the encoding/decoding source of truth for this view's
own `filters: Record<string, string>` / `onFiltersChange` contract (URL-state-backed, unchanged
for that layer's other callers) — `resolveHalFormsFields`'s `HalFormsField[]` became the new
_rendering_ source of truth (which fields, which kind, which layout), derived from the same
search template, so the two naturally agree on field names/wire types without one calling the
other.

**Alternatives considered**: adding a documented constitution exception (Governance's
"deviation... explicit, not silent") instead of promoting. Rejected per explicit direction to
promote — also the more honest fix, since the feature's actual capability (validation,
provenance, autocomplete, two-column layout, FR-023's parity requirement) was never the blocker;
only its `x-stability` label was.

## Decision: the real create-form UI now renders through this feature too (second amendment, 2026-09-18)

Same day, same-shaped direction: migrate `create-entity-item-container.tsx`/
`create-entity-item-form.tsx` off `resolveCreateFieldDescriptors`/`FormContainer`/`FieldRenderer`/
`useEntityItemCreateFormState` onto `resolveHalFormsFields`/`HalFormsContainer`/
`useHalFormsFieldState`. No stability-gate conflict this time — `hal-forms` was already `stable`
from the first amendment, and `entity-item-create` is also `stable`, so nothing needed promoting.

This required extending `useHalFormsFieldState` to parity with `useEntityItemCreateFormState`
(`setValues`/`isDirty`/`buildValues`/`reset` — none of which the search-form migration needed,
since `entity-item-collection-view.tsx` never called `buildValues` or exposed a dirty signal) and
adding a `hal-forms`-shaped `toServerFieldErrors` (mirrors `entity-item-create/state/to-field-errors.ts`'s
`toFieldErrors`), plus a `validationFieldErrors` field on `FieldValidationError` for FR-023 parity
with `entity-item-create`'s `FieldError`.

**What did NOT change**: no saved-layout persistence was wired into either path — the create-form
container has never pulled a persisted per-entity layout preference (the earlier drag-and-drop
work for that was abandoned before this migration began), so `resolveHalFormsFields(createTemplate)`
is called with no `savedLayout` argument, same one-field-per-row default
`resolveCreateFieldDescriptors` always produced. `resolveCreateFieldDescriptors`/`FormContainer`/
`FieldRenderer`/`useEntityItemCreateFormState`/`FieldDescriptor`/`LayoutInformation` and
`entity-item-create`'s own `FieldError`/`FieldState`/`toFieldErrors` are now unused by these two
files but were not deleted — same "stop importing, don't delete a still-present file" precedent
as `FilterSidebar` above. FR-022 and FR-023 are now fully resolved: both form paths render
through this one generic renderer, with no capability gap remaining between them.
