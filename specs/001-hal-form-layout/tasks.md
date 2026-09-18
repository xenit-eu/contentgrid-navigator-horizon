---
description: "Task list for Generic HAL-Forms Field Renderer"
---

# Tasks: Generic HAL-Forms Field Renderer

**Input**: Design documents from `/specs/001-hal-form-layout/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/hal-forms-public-api.md](./contracts/hal-forms-public-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included — this project's existing features are all built test-first (Vitest + RTL,
per `packages/features/CLAUDE.md`/`packages/ui/CLAUDE.md` conventions), and `quickstart.md`
already commits to the specific test file paths used below.

**Organization**: Tasks are grouped by user story (from `spec.md`) so each can be implemented,
tested, and demoed independently, in priority order (P1 → P1 → P2 → P3 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to its user story (US1–US5)

## Path Conventions

All paths are repository-relative. New feature module: `packages/features/src/hal-forms/`
(`x-stability: "experimental"` — see `plan.md`'s Constitution Check). One new `packages/ui`
pattern: `packages/ui/src/patterns/autocomplete-renderer.tsx`.

---

## Phase 1: Setup

**Purpose**: Create the new feature module's skeleton.

- [x] T001 Create `packages/features/src/hal-forms/package.json` containing `{ "x-stability": "experimental" }`, per `packages/features/CLAUDE.md`'s per-feature `package.json` convention
- [x] T002 [P] Create an empty public barrel at `packages/features/src/hal-forms/index.ts` (filled in incrementally as each user story below adds its own exports)

**Checkpoint**: Feature module exists and is a valid workspace subdirectory; nothing exported yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two shared model types every user story phase below reads or extends.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Define the `HalFormsField` discriminated union — kinds `text`, `number`, `datetime`, `boolean`, `file`, `enum`, `autocomplete`; shared base fields `name: string`, `label: string`, `required: boolean`, `readOnly: boolean`, `description?: string`, `property: HalFormsProperty`, `provenance?: ReactNode` — in `packages/features/src/hal-forms/model/hal-forms-field.ts`, per [data-model.md](./data-model.md)'s `HalFormsField` section (mirrors `entity-item-create/model/field-descriptor.ts`'s shape, generalized)
- [x] T004 [P] Define `FieldRow { fieldNames: readonly string[] }`, `FieldGroup { title?: string; rows: readonly FieldRow[] }`, and `LayoutSchema { groups: readonly FieldGroup[] }` in `packages/features/src/hal-forms/model/layout-schema.ts`, per [data-model.md](./data-model.md)'s `LayoutSchema` section (same shape as `entity-item-create/model/layout-information.ts`)

**Amendment (discovered during T008)**: `HalFormsFieldRenderer` (US1) needs the `FieldState`/
`FieldValidationError` types originally scheduled for T012 (US2) — a field renderer's `fieldState`
prop must be typeable even in US1, before any US2 state-hook logic exists. Created early as
`packages/features/src/hal-forms/state/field-error.ts` here in Foundational instead, so US1 does
not secretly depend on US2. T012 (below) is satisfied by this file already existing — its own
implementation task becomes a no-op check rather than new work.

**Checkpoint**: Foundation ready — User Story 1 can now begin.

---

## Phase 3: User Story 1 - Fields arrange into a two-column layout (Priority: P1) 🎯 MVP

**Goal**: A layout schema controls which fields render and how they're grouped into one- or
two-field rows; an omitted field never renders (spec FR-003–FR-007, FR-020).

**Independent Test**: Supply a layout schema with one two-field row, one single-field row, and
one field deliberately omitted; confirm the rendered form shows exactly two fields side by side,
one field full width, and the omitted field nowhere on the page.

### Tests for User Story 1

- [x] T005 [P] [US1] Write reconciliation tests in `packages/features/src/hal-forms/model/resolve-hal-forms-fields.test.ts`: a two-field row keeps the schema's field order (FR-005); a single-field row is marked full width; a field absent from every row of the schema is excluded from what gets rendered (FR-004); the same field named in two rows renders only in its first-listed row (FR-006); a row referencing a field no longer on the template has that reference dropped without failing the rest (FR-007); no saved layout at all falls back to one field per row, in template order
- [x] T006 [P] [US1] Write rendering tests in `packages/features/src/hal-forms/render/hal-forms-container.test.tsx`: a two-field row renders inside a `grid grid-cols-2` wrapper (both fields present, in order); a single-field row renders without that wrapper (full width)

### Implementation for User Story 1

- [x] T007 [P] [US1] Implement `resolveHalFormsFields(template: CreateHalFormTemplate, savedLayout?)` in `packages/features/src/hal-forms/model/resolve-hal-forms-fields.ts`: map `template.userDefinedProperties` to `HalFormsField[]` (port the `kind`-mapping switch from `entity-item-create/model/resolve-create-field-descriptors.ts`'s `attributeFieldDescriptor`, omitting the `autocomplete` case for now — added in User Story 5) and reconcile `savedLayout` into a `LayoutSchema` per FR-004–FR-007/FR-020 (depends on T003, T004)
- [x] T008 [P] [US1] Implement `HalFormsFieldRenderer` in `packages/features/src/hal-forms/render/hal-forms-field-renderer.tsx`: `kind`-dispatch to `@contentgrid/ui`'s `TextRenderer`/`NumberRenderer`/`BooleanRenderer`/`DateTimeRenderer`/`EnumRenderer`/`EnumMultiRenderer` (ported from `entity-item-create/render/field-renderer.tsx`), with an inert placeholder for `file` and for `autocomplete` (both handled properly in later stories) (depends on T003)
- [x] T009 [US1] Implement `HalFormsContainer` in `packages/features/src/hal-forms/render/hal-forms-container.tsx`: render `layout.groups[].rows`, wrapping a two-field row in a `grid grid-cols-2 gap-4` container and a one-field row plain full width, looking up each row's field names in `fields` via `HalFormsFieldRenderer` and silently skipping a missing lookup (ported from `entity-item-create/render/form-container.tsx`) (depends on T004, T008)
- [x] T010 [US1] Export `HalFormsField`, `LayoutSchema`, `resolveHalFormsFields`, `HalFormsContainer`, `HalFormsFieldRenderer` from `packages/features/src/hal-forms/index.ts` (depends on T007, T008, T009)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP).

---

## Phase 4: User Story 2 - Consistent validation across every form (Priority: P1)

**Goal**: A field shows a validation error from either a live client-side check or a
server-returned problem response, anchored to the correct field, clearing once fixed (FR-008–FR-010).

**Independent Test**: Trigger a live validation failure on one field (e.g. clearing a required
field) and, separately, inject a server-shaped error for another field; confirm both show an
error message anchored to the correct field, and that the error clears once a valid value is set.

### Tests for User Story 2

- [x] T011 [P] [US2] Write tests in `packages/features/src/hal-forms/state/use-hal-forms-field-state.test.ts`: a live client check (e.g. a required field left empty) produces an error with no network call (FR-008); an externally-injected `{ source: "server" }` error renders anchored to its field (FR-009); changing that field's value to one that passes the check clears its error (FR-010)

### Implementation for User Story 2

- [x] T012 [P] [US2] ~~Define `FieldValidationError`/`FieldState`~~ — already created in Foundational (see the amendment note above `field-error.ts` was needed by US1's `HalFormsFieldRenderer` before US2 began); no new work here
- [x] T013 [P] [US2] Implement a client-side validation entry point `validateField(value, validationFn?)` in `packages/features/src/hal-forms/validation/validate-field.ts`, per spec's "current data and/or a validation function" (FR-008)
- [x] T014 [US2] Implement `useHalFormsFieldState({ fields, externalErrors })` in `packages/features/src/hal-forms/state/use-hal-forms-field-state.ts`: per-field value/touched/error state; `validate()` runs T013's client-side check per field; externally-supplied (server) errors are merged in per field; a field's error clears once its value passes the check that produced it (depends on T007, T012, T013)
- [x] T015 [US2] ~~Wire each field's joined error message(s) into the `error` prop~~ — already done as part of T008's port of `field-renderer.tsx`'s existing `error` join logic; no new work here
- [x] T016 [US2] Export `useHalFormsFieldState`, `FieldValidationError` from `packages/features/src/hal-forms/index.ts` (depends on T014)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - External fill and provenance (Priority: P2)

**Goal**: An external caller can set a field's value while the form is open without clobbering an
in-progress edit; every field can show clickable, caller-supplied provenance content in a popover
(FR-011–FR-015).

**Independent Test**: Open a form, set one field's value externally, and confirm it updates with
a clickable provenance indicator that opens a popover; confirm a field being actively edited is
not overwritten by a concurrent external attempt; confirm a field with no provenance content
renders no indicator.

### Tests for User Story 3

- [x] T017 [P] [US3] Write tests in `packages/features/src/hal-forms/state/field-provenance.test.ts`: setting a value externally on an unfocused field updates both its value and `provenance` (FR-011); doing so while that field is focused is a no-op on the value (FR-012); a field with no `provenance` content has none set
- [x] T018 [P] [US3] Write a component test in `packages/features/src/hal-forms/render/hal-forms-field-renderer.test.tsx`: clicking a field's rendered provenance indicator opens a popover showing that field's provenance content (FR-013/FR-014); a field with no provenance content renders no indicator element at all (FR-015)

### Implementation for User Story 3

- [x] T019 [P] [US3] Implement the focused-field guard function in `packages/features/src/hal-forms/state/field-provenance.ts`: given the current per-field focus state, decide whether an external value/provenance write for that field should apply (depends on T003)
- [x] T020 [US3] Add `setExternalValue(name, value, provenance)` to `useHalFormsFieldState`'s returned API in `packages/features/src/hal-forms/state/use-hal-forms-field-state.ts`, tracking each field's focused state and applying T019's guard before writing (depends on T014, T019)
- [x] T021 [P] [US3] Render `fieldState?.provenance` (when present — read off per-field state, not off `field`, since provenance describes the current value's runtime origin) as a clickable indicator opening a `Popover` in `packages/features/src/hal-forms/render/hal-forms-field-renderer.tsx`; render nothing for that slot when absent (depends on T008). **Discovered during implementation**: `packages/ui` already has a `ProvenanceTag` pattern (`patterns/provenance-tag.tsx`) — the exact component the clarify session's "the provenance tags will also be clickable with a popover" answer was naming. The trigger now reuses `<ProvenanceTag kind="modified" />` as its visible chip instead of a bespoke text link; the caller-supplied `provenance` content still renders inside the popover.
- [x] T022 [US3] ~~Export the extended `useHalFormsFieldState`~~ — already covered by T016's export statement (same named export, now with a richer return type); no new work here

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Search forms pair range fields automatically (Priority: P3)

**Goal**: When no explicit layout schema is supplied for a search form, its generated default
places a property's `~before`/`~after` variants on one row — expressed as an ordinary layout
schema, not a special rendering case (FR-016–FR-021).

**Independent Test**: Render a search form (no explicit layout schema) for a property exposing
both range variants and confirm they land in one generated row together; confirm a lone variant
gets its own row; confirm an explicit layout schema, when supplied, is used as-is instead.

### Tests for User Story 4

- [x] T023 [P] [US4] Write tests in `packages/features/src/hal-forms/model/generate-search-form-layout.test.ts`: two direction-labeled siblings (`After`/`Before` or `From`/`Until`) sharing one `groupKey` produce one two-field row (FR-019); a property with only one range variant gets its own full-width row (FR-019); a plain non-range field gets its own row in `fields` order; a range sibling absent from `fields` (didn't survive resolution) is not paired

### Implementation for User Story 4

- [x] T024 [P] [US4] Implement `generateSearchFormLayout(searchTemplate: SearchHalFormTemplate, fields: readonly HalFormsField[])` in `packages/features/src/hal-forms/model/generate-search-form-layout.ts`. **Design refinement made during implementation**: takes the already-resolved `fields`, not just the raw template — grouping only fields that survived T025's redundancy suppression, rather than re-deriving that suppression a second time here. Groups by `groupKey` (looked up per field name against `searchTemplate.searchProperties`), reusing the `After`/`Before`/`From`/`Until` direction-label classification ported from `packages/features/src/search/filter-properties.ts`'s `computeDirectionLabel`, pairing two direction-labeled siblings into one row and giving every other field its own row, in `fields` order (depends on T004)
- [x] T025 [US4] Extend `resolveHalFormsFields` in `packages/features/src/hal-forms/model/resolve-hal-forms-fields.ts` to also accept a `SearchHalFormTemplate`: map `searchTemplate.searchProperties` to `HalFormsField[]` (port the wire-type-to-kind mapping and redundant-sibling suppression from `filter-properties.ts`'s `buildFilterProperties`/`mapWireTypeToInputKind`/`isRedundantExactMatch`/`isRedundantStrictRangeBound`), and call T024's generator instead of the one-field-per-row default only when no `savedLayout` is given for a search template (FR-018, FR-021) (depends on T007, T024)

**Checkpoint**: User Stories 1 through 4 all work independently.

---

## Phase 7: User Story 5 - Autocomplete field kind (Priority: P3)

**Goal**: A new `autocomplete` field kind offers the same suggest-as-you-type behavior as the
existing search filter bar's combobox (FR-017).

**Independent Test**: Render a single autocomplete field, type a partial value, confirm matching
suggestions appear and one can be selected; confirm a value already set displays as the current
selection.

### Tests for User Story 5

- [x] T026 [P] [US5] Write tests in `packages/ui/src/patterns/autocomplete-renderer.test.tsx`: typing into the input calls `onQueryChange` with the typed text; passing `suggestions` renders them as selectable options; selecting one calls `onChange` with that value; an initial `value` displays as the current selection

### Implementation for User Story 5

- [x] T027 [P] [US5] Implement `<AutocompleteRenderer name label required readOnly description? value onChange error? suggestions isLoading? onQueryChange />` in `packages/ui/src/patterns/autocomplete-renderer.tsx`, extracting the existing combobox pattern (`Popover` + `Input` + `aria-autocomplete="list"` + arrow/enter/escape keyboard nav) out of `packages/ui/src/patterns/filter-sidebar/filter-sidebar.tsx`'s `TypeaheadTextFilter` into a standalone, descriptor-agnostic pattern per `packages/ui/CLAUDE.md`'s plain-scalar-prop rule
- [x] T028 [US5] Add `packages/ui/src/patterns/autocomplete-renderer.stories.tsx` per `packages/ui/CLAUDE.md`'s story requirement, and export `AutocompleteRenderer` from `packages/ui/src/index.ts` (depends on T027)
- [x] T029 [P] [US5] Add the `autocomplete` case to `HalFormsFieldRenderer`'s `kind` switch in `packages/features/src/hal-forms/render/hal-forms-field-renderer.tsx` (depends on T008, T027). **Scope correction made during implementation**: calling `useTypeahead` directly from this generic, template-agnostic renderer isn't possible — `useTypeahead` needs `profileEntity`/`searchProperty` context this component never receives, and the real create/search-form call sites that would have that context are explicitly out of scope (FR-022). Instead, added `FieldAutocompleteState { suggestions, isLoading?, onQueryChange }` to `state/field-error.ts`'s `FieldState` (same pattern as `provenance` — runtime data read off `fieldState`, not off `field`). The `autocomplete` case renders `AutocompleteRenderer` when `fieldState.autocomplete` is wired up, else the same inert placeholder as `file`. A future container (out of scope here) calls `useTypeahead` and populates `fieldState.autocomplete` — mirrors `filter-sidebar.tsx`'s existing external-suggestions boundary exactly; `packages/ui` itself never imports `useTypeahead`.
- [x] T030 [P] [US5] Extend `resolveHalFormsFields` in `packages/features/src/hal-forms/model/resolve-hal-forms-fields.ts` to classify an eligible property as `kind: "autocomplete"` for both the create and search paths (depends on T007, T025)

**Checkpoint**: All five user stories work independently. Full feature scope (FR-001–FR-021) delivered.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the one documented follow-up from `research.md`.

- [x] T031 [P] Run `pnpm --filter @contentgrid/features exec tsc --noEmit` and `pnpm --filter @contentgrid/features run lint`, fixing any errors under `packages/features/src/hal-forms/`
- [x] T032 [P] Run `pnpm --filter @contentgrid/ui exec tsc --noEmit` and `pnpm --filter @contentgrid/ui run lint`, fixing any errors in `packages/ui/src/patterns/autocomplete-renderer.tsx`
- [x] T033 Add a demo route (`apps/navigator-experimental/src/routes/hal-forms-demo.tsx`, `DEV`-gated like `config.tsx`) rendering `HalFormsContainer` against both a fixture `CreateHalFormTemplate` and a fixture `SearchHalFormTemplate`, per [quickstart.md](./quickstart.md)'s manual end-to-end smoke check
- [x] T034 Executed every automated command in [quickstart.md](./quickstart.md) (US1–US5 test files, 35 tests total, all passing) plus typecheck/lint for both packages. Verified the T033 demo route via the dev server: registered route (200 response), module transforms without error, workspace-package imports (`@contentgrid/features/hal-forms`, `@contentgrid/navigator-data`) resolve correctly. **Limitation**: no browser was available in this session to visually click through the rendered forms (per Constitution's UI-verification rule, stated explicitly rather than implied) — the HTTP/compile-level check above is what was actually verified, not full visual/interactive confirmation. Decision: keeping the demo route (see T033) rather than removing it.
- [x] T035 [P] Update `packages/features/src/entity-item-create/model/field-descriptor.ts`'s doc comment per [research.md](./research.md)'s "superseding" decision: note that a generic, unified renderer now exists at `packages/features/src/hal-forms` (without this file having been migrated onto it), rather than leaving the stale "no future migration" claim uncorrected

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational only. This is the MVP slice every later
  story builds on.
- **User Story 2 (Phase 4)**: Depends on Foundational + User Story 1's `resolveHalFormsFields`/
  `HalFormsFieldRenderer` (T007, T008) — independently testable per its own Independent Test.
- **User Story 3 (Phase 5)**: Depends on Foundational + User Story 1 (T008) + User Story 2's state
  hook (T014, extended rather than duplicated).
- **User Story 4 (Phase 6)**: Depends on Foundational + User Story 1's `resolveHalFormsFields` (T007).
- **User Story 5 (Phase 7)**: Depends on Foundational + User Story 1's field renderer (T008) +
  User Story 4's `resolveHalFormsFields` extension (T025) — the `autocomplete` kind is classified
  in the same resolver both the create and search paths already share.
- **Polish (Phase 8)**: Depends on every user story phase being complete.

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task lands.
- Model/type tasks before the render/state tasks that consume them.
- Each story's own Checkpoint marks it independently demoable before moving to the next.

### Parallel Opportunities

- T001/T002 (Setup) — no interdependency.
- T003/T004 (Foundational) — different files.
- Within User Story 1: T005/T006 (tests) in parallel; T007/T008 (implementation) in parallel once
  Foundational is done; T009 waits on T008.
- Within User Story 2: T012/T013 in parallel; T011 (test) parallel with either.
- Within User Story 3: T017/T018 (tests) in parallel; T019 parallel with US1/US2 work; T021
  parallel with T020 (different files).
- Within User Story 4: T023 (test) parallel with T024; T025 is the phase's only sequential step.
- Within User Story 5: T026 (test) parallel with T027; T029/T030 in parallel once T027/T025 exist.
- Once Foundational is done, User Stories 1, 2, and 4 could in principle be staffed in parallel by
  different developers — but 2 and 5 each extend a file (`use-hal-forms-field-state.ts`,
  `resolve-hal-forms-fields.ts`) that a still-in-progress earlier story also touches, so sequential
  (priority) order is the safer default for a single contributor, which is why this list is
  ordered P1 → P1 → P2 → P3 → P3.

---

## Parallel Example: User Story 1

```bash
# Tests (different files):
Task: "Write reconciliation tests in packages/features/src/hal-forms/model/resolve-hal-forms-fields.test.ts"
Task: "Write rendering tests in packages/features/src/hal-forms/render/hal-forms-container.test.tsx"

# Implementation (different files, both depend only on Foundational):
Task: "Implement resolveHalFormsFields in packages/features/src/hal-forms/model/resolve-hal-forms-fields.ts"
Task: "Implement HalFormsFieldRenderer in packages/features/src/hal-forms/render/hal-forms-field-renderer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything else).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run `quickstart.md`'s US1 command; confirm the independent test passes.
5. This alone is demoable: a layout schema controlling row grouping and field visibility, with
   real widget rendering for every non-autocomplete kind.

### Incremental Delivery

1. Setup + Foundational → User Story 1 (MVP: layout) → validate → demo.
2. - User Story 2 (validation) → validate → demo.
3. - User Story 3 (external fill + provenance) → validate → demo.
4. - User Story 4 (search default layout) → validate → demo.
5. - User Story 5 (autocomplete kind) → validate → demo.
6. Polish (Phase 8) — typecheck/lint sweep, manual smoke check, the one documented doc-comment
   follow-up.

Each step adds value without breaking any earlier story — every later phase only extends files an
earlier phase created, never rewrites their existing behavior.

---

## Phase 9: Real search-form migration (amendment, added post-implementation, 2026-09-18)

**Not part of the original plan** — FR-022 (see `spec.md`'s second Clarifications session)
changed mid-implementation: the user directed migrating the real search-filter UI
(`entity-item-collection-view.tsx`) onto this renderer, deprecating `FilterSidebar` for that call
site. These tasks are numbered continuing from T035 for a single linear record, not reshuffled
into the phases above.

- [x] T036 [P] Promote `packages/features/src/hal-forms/package.json`'s `x-stability` from `"experimental"` to `"stable"` — required because `entity-item-collection` (the migration target) is `stable`, and Principle IV forbids a `stable` feature importing an `experimental` one. Dependency graph checked clean first (no feature-level dependencies).
- [x] T037 [P] Expose `SearchHalFormTemplate.profileEntity` publicly in `packages/navigator-data/src/accessors/extended-forms/search-form.ts` (one-word change: `private readonly` → `public readonly` on the existing constructor parameter property) — needed so a resolved `HalFormsField`'s `searchContext` can carry the profile alongside the search property. Verified: navigator-data's full suite (811 tests) still passes.
- [x] T038 [US4/US5] Auto-classify a prefix-match/full-text search property as `kind: "autocomplete"` in `resolve-hal-forms-fields.ts`'s `searchPropertyHalFormsField` (no opt-in needed for search, unlike the create path — every such property already gets this behavior today), attaching `searchContext: { profileEntity, searchProperty }`. Also append the property's direction label ("After"/"Before"/"From"/"Until", reusing `generate-search-form-layout.ts`'s now-exported `directionLabel`) to a directional field's own label — `HalFormsField` has no separate sub-label slot the way the old `directionLabel` badge did, so without this two paired siblings would render with an identical, ambiguous label.
- [x] T039 [US5] Add `SearchAutocompleteContext`/`searchContext` to the `autocomplete` variant of `HalFormsField` in `model/hal-forms-field.ts` — static, template-resolved metadata (distinct from `FieldState.autocomplete`'s runtime suggestion data), so a caller doesn't need to re-derive the `SearchHalFormTemplateProperty` lookup itself.
- [x] T040 Migrate `packages/features/src/entity-item-collection/entity-item-collection-view.tsx` from `FilterSidebar` (`@contentgrid/ui`) to `HalFormsContainer` (`@contentgrid/features/hal-forms`) for its Filters dialog: `resolveHalFormsFields(searchTemplate)` for fields/layout; `filterFieldValues`/`encodeFilterValue` bridge the typed `HalFormsContainer` values to/from the view's own `filters: Record<string, string>` contract (unchanged for its own callers); `filterProperties`/`coerceFilterValue`/`findInvalidFilterKeys`/etc. (`../search/filter-properties`) stay the encoding/decoding source of truth — only rendering moved. The view still owns its own `useTypeahead` call and feeds results into `fieldState[name].autocomplete`, per T038's reverted-and-corrected design (FR-024).
- [x] T041 [P] Add filter-form tests to `entity-item-collection-view.test.tsx`: every search property gets a labeled input when Filters opens; the prefix-match property renders as an autocomplete combobox; a typed number value round-trips through `onFiltersChange`; an already-applied value pre-fills its input; an invalid already-applied value shows its error; Clear all empties every filter. All 11 pre-existing tests in this file (pageUrl/filters reconciliation, Columns picker) still pass unchanged.
- [x] T042 [P] Verify no regressions: full `@contentgrid/features` suite (445 tests, 59 files), full `@contentgrid/navigator-data` suite (811 tests), and both apps' (`navigator`, `navigator-experimental`) typecheck all pass.

**Note**: `FilterSidebar`/`TypeaheadTextFilter` (`packages/ui`) are now unused by
`entity-item-collection-view.tsx` but were not deleted — no other call site was identified or
asked to be touched, and removing a still-exported pattern is a separate, deliberate cleanup
decision the user hasn't asked for yet.

---

## Phase 10: Real create-form migration (amendment, added post-implementation, 2026-09-18)

**Not part of the original plan** — continues the FR-022 supersession from Phase 9: the user
directed also migrating the real create-entity-item UI
(`create-entity-item-container.tsx`/`create-entity-item-form.tsx`) onto this renderer, retiring
`resolveCreateFieldDescriptors`/`FormContainer`/`FieldRenderer`/`useEntityItemCreateFormState` for
that call site. Numbered continuing from T042 for a single linear record.

- [x] T043 [P] Extend `useHalFormsFieldState` (`packages/features/src/hal-forms/state/use-hal-forms-field-state.ts`) to full parity with `useEntityItemCreateFormState`: added `setValues`, `isDirty`, `buildValues`, `reset` — the create-form container needs all four (`buildValues` to encode a HAL-FORMS request on submit, `reset`/`isDirty` for its existing `onDirtyChange` contract) and the search-form migration (Phase 9) never needed them.
- [x] T044 [P] Add `validationFieldErrors?: readonly ValidationFieldError[]` to `hal-forms`'s `FieldValidationError` (`state/field-error.ts`) for parity with `entity-item-create`'s `FieldError.validationFieldErrors` (FR-023) — kept the spec-aligned `"client"/"server"` source naming rather than renaming to `entity-item-create`'s `"internal"/"external"`.
- [x] T045 [P] Add `toServerFieldErrors` (`packages/features/src/hal-forms/state/to-server-field-errors.ts`), a `hal-forms`-shaped generalization of `entity-item-create/state/to-field-errors.ts`'s `toFieldErrors`: groups a validation problem's `errors[]` by `field` into `Record<string, FieldValidationError[]>` with `source: "server"`. Exported from the feature barrel so any `hal-forms` consumer can reuse it, not just this call site.
- [x] T046 Migrate `create-entity-item-container.tsx` from `resolveCreateFieldDescriptors`/`useEntityItemCreateFormState`/`toFieldErrors` to `resolveHalFormsFields`/`useHalFormsFieldState`/`toServerFieldErrors` (all from `../hal-forms`). No saved-layout wiring existed to carry over — the create-form container has never pulled a persisted per-entity layout (that earlier drag-and-drop work was abandoned before this migration), so `resolveHalFormsFields(createTemplate)` is called with no `savedLayout` argument, same one-field-per-row default the old bridge produced.
- [x] T047 Migrate `create-entity-item-form.tsx` from `FormContainer`/`FieldDescriptor`/`LayoutInformation`/`entity-item-create`'s `FieldState` to `HalFormsContainer`/`HalFormsField`/`LayoutSchema`/`hal-forms`'s `FieldState` (all from `../hal-forms`) — the `<form>` tag and submit/cancel chrome are unchanged.
- [x] T048 [P] Verify no regressions: `create-entity-item-container.test.tsx`'s existing 9 tests (field rendering, required-field client/blur validation, submit + `onCreated`, `onDirtyChange` round-trip, server validation error mapped to its field, non-field alert for an unrendered field's error, stale-alert clearing on a blocked resubmit) all pass unchanged against the migrated implementation — none of them depended on `entity-item-create`'s internal types. Full `@contentgrid/features` suite (450 tests, 59 files) and both apps' typecheck all pass.

**Note**: `resolveCreateFieldDescriptors`, `FormContainer`, `FieldRenderer`,
`useEntityItemCreateFormState`, `FieldDescriptor`, `LayoutInformation`, and
`entity-item-create`'s own `FieldError`/`FieldState`/`toFieldErrors` are now unused by
`create-entity-item-container.tsx`/`create-entity-item-form.tsx` but were not deleted — same
"stop importing, don't delete a still-present file" precedent as Phase 9's `FilterSidebar` note
above. Their own dedicated unit tests (`resolve-create-field-descriptors.test.ts`,
`field-renderer.test.tsx`, `form-container.test.tsx`, `use-entity-item-create-form-state.test.ts`)
were left untouched and still pass, since they test the modules directly rather than through the
now-migrated container.

---

## Phase 11: Titled, described, collapsible sections (amendment, added post-implementation, 2026-09-18)

**Not part of the original plan** — the user asked for the layout schema's grouping unit to gain
a visible title, an optional description, and independent collapse/expand behavior (e.g. to label
"all the search properties of a related profile" as one named section). See `spec.md`'s new
FR-025 through FR-027. Numbered continuing from T048.

- [x] T049 [P] Rename `FieldGroup` → `FieldSection` and `LayoutSchema.groups` → `LayoutSchema.sections` (`packages/features/src/hal-forms/model/layout-schema.ts`); add `description?: string` and `isCollapsible?: boolean` to `FieldSection`. `title` stays optional, unchanged from before.
- [x] T050 [P] Update every `groups`/`FieldGroup` reference to `sections`/`FieldSection` across the feature: `resolve-hal-forms-fields.ts` (`buildFieldGroup` → `buildFieldSection`), `generate-search-form-layout.ts`, `index.ts`'s barrel export, and `entity-item-collection-view.tsx`'s empty-layout fallback (`{ groups: [] }` → `{ sections: [] }`).
- [x] T051 [US1] Render a section's `title`/`description` as a header above its rows in `hal-forms-container.tsx` (FR-025/FR-026) — a section with neither renders no header, identical to every layout this feature produced before sections existed (all single, untitled sections).
- [x] T052 [US1] Render a section with `isCollapsible: true` as a single `Accordion` item (`@contentgrid/ui`) wrapping all of that section's rows together — never per-row — with the header (if any) as the trigger; defaults to expanded (FR-027). A non-collapsible section (the default) keeps rendering with no collapse behavior at all.
- [x] T053 [P] Update existing `hal-forms` tests' `layout={{ groups: [...] }}` fixtures to `{ sections: [...] }` (`hal-forms-container.test.tsx`, `resolve-hal-forms-fields.test.ts`, `generate-search-form-layout.test.ts`); add new `hal-forms-container.test.tsx` coverage: no header for an untitled section, title+description render above rows, a non-collapsible titled section's rows stay always visible, a collapsible section's rows are visible by default and hide on toggle-click.
- [x] T054 [P] Verify no regressions: full `@contentgrid/features` suite (454 tests, 59 files) and both apps' typecheck all pass. Update `spec.md` (FR-025–027, Clarifications, Key Entities), `data-model.md` (`FieldSection` shape + rendering rules), `contracts/hal-forms-public-api.md`, and `plan.md`'s Project Structure block to match.

---

## Phase 12: Relation-scoped search properties get their own collapsible section (amendment, added post-implementation, 2026-09-18)

**Not part of the original plan** — the user asked for the concrete example from Phase 11's own
motivation to actually be implemented: group "all the different search properties of a related
profile" into one named, collapsible section. See `spec.md`'s new FR-028. Numbered continuing
from T054.

- [x] T055 [US4] Extend `generateSearchFormLayout` (`packages/features/src/hal-forms/model/generate-search-form-layout.ts`) to bucket its already-paired rows into sections instead of one flat list: a new `groupRowsIntoSections` helper reads each row's field's relation off a `relationByName` map (built from `searchTemplate.searchProperties`'s `isOverRelation`/`profileRelation`), places every relation-traversal row into a section keyed by `profileRelation.name` (title `profileRelation.title`, `isCollapsible: true`), in first-appearance order, and every direct-property row into one leading, untitled, non-collapsible section — omitted entirely when it would be empty (every field turned out to be relation-scoped).
- [x] T056 [P] Add test coverage to `generate-search-form-layout.test.ts`: extended the fixture profile with an `assignee` relation and two relation-scoped search properties (`assignee.name~prefix`, `assignee.email`); added tests confirming relation properties land in a second, titled+collapsible section, direct properties stay in a plain leading section alongside one, and the leading section is omitted when every field is relation-scoped. All 4 pre-existing tests in this file (which never reference a relation-scoped field) pass unchanged.
- [x] T057 [P] Verify no regressions: full `@contentgrid/features` suite (457 tests, 59 files) and both apps' typecheck all pass. Update `spec.md` (FR-028, Clarifications) and `data-model.md` (`generateSearchFormLayout`'s section-bucketing rule) to match.

---

## Phase 13: Relation description moves from every field to the section only (amendment, added post-implementation, 2026-09-18)

**Not part of the original plan** — a relation-traversal field's `description` fell back to
`profileRelation.description` (from before sections existed, when there was no section to show it
on instead). Now that Phase 12 gives the relation its own section, the user asked for the
description to live there only — not duplicated on every field beneath it. See `spec.md`'s new
FR-029. Numbered continuing from T057.

- [x] T058 [US4] Set `description: relation.description || undefined` on a relation section in `generate-search-form-layout.ts`'s `groupRowsIntoSections` (FR-029).
- [x] T059 [US4] Remove the `?? (profileRelation?.description || undefined)` fallback from `searchPropertyHalFormsField` (`resolve-hal-forms-fields.ts`) — a relation-traversal field's `description` now comes only from `profileAttribute?.description`, which never resolves for a relation traversal, so such a field simply has no description of its own (FR-029).
- [x] T060 [P] Add test coverage: `generate-search-form-layout.test.ts`'s relation-section test now also asserts the section's `description` (extended the `assignee` relation fixture with a real description); `resolve-hal-forms-fields.test.ts` gained a `company` relation + `company.name~prefix` search property and a new test confirming that field's `description` is `undefined`, not the relation's.
- [x] T061 [P] Verify no regressions: full `@contentgrid/features` suite (458 tests, 59 files) and both apps' typecheck all pass. Update `spec.md` (FR-029, Clarifications) and `data-model.md` (`generateSearchFormLayout`'s section description + the field-level fallback removal) to match.
