---
description: "Task list for Advanced Single Search Bar with Autocomplete"
---

# Tasks: Advanced Single Search Bar with Autocomplete

**Input**: Design documents from `/specs/003-single-search-autocomplete/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/hooks-and-components.md](./contracts/hooks-and-components.md), [quickstart.md](./quickstart.md)

**Tests**: Included — the constitution's Development Workflow gate requires MSW-backed HAL contract tests for new/changed hooks and Playwright story snapshots for UI-affecting pattern changes, and the plan's Technical Context names Vitest test tasks explicitly.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US6)
- File paths are exact, relative to the repo root

## Path Conventions

Per [plan.md](./plan.md)'s Project Structure: `packages/navigator-data/src/hooks/collection/`, `packages/features/src/entity-search-bar/` (new), `packages/features/src/search/`, `packages/features/src/entity-item-collection/`, `packages/ui/src/patterns/`, `apps/navigator-experimental/src/routes/_app/$entity/`.

---

## Phase 1: Setup

**Purpose**: Scaffold the new `experimental` feature directory (Constitution IV — every feature starts `experimental`; research D3 — cannot live inside an already-`stable` directory).

- [x] T001 Scaffold `packages/features/src/entity-search-bar/`: create `package.json` with `{ "x-stability": "experimental" }`, an empty `index.ts` barrel, and an empty `util/` subfolder.

**Checkpoint**: New feature directory exists and satisfies the per-feature `x-stability` lint requirement.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The data-fetching and pure-transformation infrastructure every user story's UI depends on (research D1, D4, D5; contracts §1–3).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Implement `useEntitySearchSuggestions` in `packages/navigator-data/src/hooks/collection/use-entity-search-suggestions.ts`: resolve contributing properties from `profileEntity.searchTemplate.searchProperties` filtered to `prefix-match`/`full-text` operators (same predicate as `resolveHalFormsFields`'s `isStringSearchable`); fan out one query per contributing property via `useQueries` (mirroring `useProfileEntities`'s pattern, per Rules-of-Hooks safety in `packages/navigator-data/CLAUDE.md`); for each property fetch (a) value-suggestion candidates the same way `useTypeahead` already does per-property (reusing its relation-traversal target-resolution for a relation-traversal property) and (b) up to a small capped page of current-entity-type record candidates via `searchEntityRequest` (never the related entity's own collection, even for a relation-traversal property — research D2, satisfies FR-024 structurally); disable below `minLength` (default 2, matching `useTypeahead`); return `{ searchTermSuggestions: readonly SearchTermSuggestionCandidate[], effectiveMatchCandidates: readonly EntityItem[], isLoading, isError, refetch }` where `isLoading` is true while any request is in flight and `isError` is true only once every request has settled with zero usable results across all of them (research D6). Export it (and its option/result types) from `packages/navigator-data/src/hooks/index.ts`.
- [x] T003 [P] MSW-backed HAL contract test in `packages/navigator-data/src/hooks/collection/use-entity-search-suggestions.test.ts`: covers a direct prefix-match property, `isLoading`/`isError`/`refetch` transitions, and the below-`minLength` disabled state. (Relation-traversal and multi-attribute cases are added in Phase 4 / US2, T012.)
- [x] T004 [P] Implement `applySuggestionBudget` in `packages/features/src/entity-search-bar/util/suggestion-budget.ts` + test in `suggestion-budget.test.ts`: groups candidates by `attributeGroupKey`, dedupes `value` within each group, divides a `totalCap` (default 20) evenly across groups with a matching candidate, redistributes a group's unused share to groups with more candidates without exceeding `totalCap` (FR-025, FR-026) — pure function, no I/O, deterministic regardless of input array order.
- [x] T005 [P] Implement `selectEffectiveMatches` in `packages/features/src/entity-search-bar/util/effective-match-selection.ts` + test in `effective-match-selection.test.ts`: dedupes candidates by `item.id`, orders by a passed-in `currentSortOption` (falling back to the collection's server-returned order when absent — never an ad-hoc relevance score, FR-028), truncates to a `cap` (default 5, FR-007/008/024) — pure function, no I/O.

**Checkpoint**: Foundational data/logic layer complete and independently unit-tested; user story UI work can begin.

---

## Phase 3: User Story 1 - Quick search from a single input (Priority: P1) 🎯 MVP

**Goal**: A single search input above the collection list; typing shows search-term suggestions and up to 5 effective-match records; selecting either applies a filter or navigates; clearing resets the list; the bar is hidden when the entity has no searchable field.

**Independent Test**: Open any entity collection with a searchable field, type a value, confirm both suggestion kinds appear, select one of each kind and confirm the described behavior, then clear the box.

### Implementation for User Story 1

- [x] T006 [US1] Implement `SearchSuggestionsPopover` in `packages/ui/src/patterns/search-suggestions-popover.tsx` per contracts §6 (core props only: `query`, `onQueryChange`, `searchTermSuggestions`, `effectiveMatches`, `onSelectSearchTermSuggestion`, `onSelectEffectiveMatch`) — built from the existing `Popover`/`Input` primitives, the same construction `autocomplete-renderer.tsx` already uses (no new dependency, per research D10); plain scalar/array props only, no `HalFormsField`/`SearchHalFormTemplateProperty` (Constitution III). Renders search-term suggestions, then effective-match records below them (FR-007).
- [x] T007 [P] [US1] `search-suggestions-popover.test.tsx` (render + selection callbacks) and `search-suggestions-popover.stories.tsx` (ADR-009 visual regression) alongside T006.
- [x] T008 [US1] Implement the view in `packages/features/src/entity-search-bar/entity-search-bar.tsx`: owns local query state; calls `useEntitySearchSuggestions` (T002), then `applySuggestionBudget` (T004) and `selectEffectiveMatches` (T005) before rendering `SearchSuggestionsPopover` (T006); hides itself entirely when `profile.searchTemplate` has no prefix-match/full-text property (FR-001/002); on selecting a search-term suggestion, calls a caller-supplied `onFiltersChange`-shaped callback with the suggestion's `propertyName`/`value` (FR-010); on selecting an effective match, calls a caller-supplied navigate callback with the record's id (FR-011); lets a typed-but-unconfirmed term be applied directly without a suggestion pick (FR-012); clearing the input resets to the unfiltered/otherwise-filtered state (FR-013).
- [x] T009 [P] [US1] `entity-search-bar.test.tsx`: covers show/hide gating, typed-term-direct-apply, clear, and both selection callbacks.
- [x] T010 [US1] Wire `EntitySearchBar` into `apps/navigator-experimental/src/routes/_app/$entity/index.tsx`, rendered above `EntityItemCollectionSearchView`, passed the SAME `filters`/`onFiltersChange` already wired there and a navigate-to-item-detail callback matching the existing `onEntityItemClick` route (contracts §7) — no new prop added to `EntityItemCollectionView`/`EntityItemCollectionSearchView` (FR-018).
- [x] T011 [US1] Export `EntitySearchBar` (and its public prop type) from `packages/features/src/entity-search-bar/index.ts`.

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md scenario 1 core flow, scenario 4).

---

## Phase 4: User Story 2 - Suggestions across every searchable attribute (Priority: P1)

**Goal**: Prove and finish the breadth this bar exists for — relation-traversal attributes included, the 20-suggestion budget enforced, each suggestion attributed to its source attribute/relation, a live loading indicator, and a distinct, retryable error state — without the suggestion list ever reordering on its own when idle.

**Independent Test**: Type a term matching a relation-traversal attribute and confirm a search-term suggestion (never an effective match for the related entity) appears labeled with the relation; type a term matching many attributes and confirm the total suggestion count never exceeds 20; simulate a request failure and confirm a distinct, retryable error state.

### Implementation for User Story 2

- [x] T012 [P] [US2] Extend `use-entity-search-suggestions.test.ts` (T003) with cases for: a relation-traversal contributing property (asserting its effective-match candidates are still the CURRENT entity type, FR-024), and a fixture with enough contributing attributes/values to exercise `applySuggestionBudget`'s 20-cap and redistribution end-to-end through the hook (FR-003, FR-025, FR-026).
- [x] T013 [P] [US2] Add attribute/relation-label display to `search-suggestions-popover.tsx` (T006) for each search-term suggestion (`attributeLabel`, optional `relationLabel`), and update its test/stories (FR-004).
- [x] T014 [P] [US2] Add a loading indicator and a distinct "suggestions failed" error state with a retry action to `search-suggestions-popover.tsx` (T006), separate from the existing empty "no matches" rendering, and update its test/stories (FR-014, FR-015, FR-027).
- [x] T015 [US2] In `entity-search-bar.tsx` (T008), propagate the hook's `isLoading`/`isError`/`refetch` (T002) into the new popover props from T014 (depends on T008, T014).
- [x] T016 [P] [US2] Add a test to `entity-search-bar.test.tsx` (T009) proving the suggestion list updates on every keystroke that changes the query and does NOT change when the query is unchanged (FR-009).

**Checkpoint**: User Stories 1 AND 2 together are the full P1 MVP the spec itself defines (quickstart.md scenarios 1–3).

---

## Phase 5: User Story 3 - Search stays part of the shareable view state (Priority: P2)

**Goal**: The active search term survives a page refresh and round-trips through a shared/copied URL, the same way existing filters and sort already do.

**Independent Test**: Enter a search term, copy the URL, open it in a new tab, confirm the term and results are restored; navigate away and back via browser history and confirm the same.

### Implementation for User Story 3

- [x] T017 [P] [US3] Implement `decodeSearchTermFromSearchState`/`applySearchTermToSearchState` in `packages/features/src/search/search-term-url-state.ts` + test in `search-term-url-state.test.ts`: a single scalar `q` key in the existing `EntitySearchState` bag, following the exact pattern of the existing `decodeSortFromSearchState`/`applySortToSearchState` siblings in `sort-url-state.ts` (FR-016).
- [x] T018 [US3] Export the two new functions from `packages/features/src/search/index.ts` (depends on T017).
- [x] T019 [US3] In `apps/navigator-experimental/src/routes/_app/$entity/index.tsx`, add `q` URL-state wiring mirroring the existing `sort`/`s.*` wiring already in that file, and connect it to `EntitySearchBar`'s query state (make the query a controlled prop sourced from/written back to this URL state) (depends on T010, T018).
- [x] T020 [P] [US3] Add a test proving the search term round-trips through a captured URL and through browser back/forward, alongside the existing route test file's conventions (FR-016).

**Checkpoint**: User Stories 1–3 all independently functional (quickstart.md scenario 5).

---

## Phase 6: User Story 4 - Quick filtering on constrained-value fields (Priority: P3)

**Goal**: Typing narrows a constrained (allowed-values) field's own option list instantly, client-side, with no loading state.

**Independent Test**: Type a partial value matching one of a constrained field's allowed values and confirm it appears as a suggestion with no visible loading delay; select it and confirm it applies as a filter.

### Implementation for User Story 4

- [x] T021 [P] [US4] Implement `filterEnumOptions` in `packages/features/src/entity-search-bar/util/enum-quick-filter.ts` + test in `enum-quick-filter.test.ts`: pure, synchronous substring match against each `EnumOption`'s `label`/`value` (FR-019).
- [x] T022 [P] [US4] (simplified: merged into the existing search-term suggestion list/section rather than a separate popover section — see entity-search-bar.tsx's enumSuggestionCandidates; contracts already specified these apply "the same way" as any other search-term suggestion) Add an allowed-value suggestion section to `search-suggestions-popover.tsx` (T006) and update its test/stories (FR-019).
- [x] T023 [US4] In `entity-search-bar.tsx` (T008), resolve the entity's `enum`-kind `HalFormsField`s (via `resolveHalFormsFields`), run their inline `options` through `filterEnumOptions` (T021) against the typed query, and render the results through the new popover section (T022), applying a selection the same way any other search-term suggestion is applied (depends on T008, T021, T022).

**Checkpoint**: User Stories 1–4 all independently functional (quickstart.md scenario 6, enum portion).

---

## Phase 7: User Story 5 - Quick sort from the search surface (Priority: P3)

**Goal**: Pick a sort order directly from the search surface, sharing the exact same underlying sort state and options the collection's existing sort control already uses.

**Independent Test**: Pick a sort option from the search surface and confirm the list re-sorts and the collection's own sort indicator shows the same choice.

### Implementation for User Story 5

- [x] T024 [US5] Export the existing `toRecordTableSortOptions` helper from `packages/features/src/entity-item-collection/entity-item-collection-table.tsx` (additive change to this already-`stable` file; an experimental feature importing a stable one is permitted per research D3) so it can be reused without duplicating the `profile.searchTemplate.sortOptions` → `RecordTableSortOption[]` mapping (FR-020).
- [x] T025 [P] [US5] Add a sort-control section to `search-suggestions-popover.tsx` (T006) (`sortOptions`, `currentSort`, `onSortChange` props) and update its test/stories (FR-020).
- [x] T026 [US5] In `entity-search-bar.tsx` (T008), compute sort options via T024's export and wire the section from T025 to the SAME `onSortChange` callback the route already passes into `EntityItemCollectionView` (contracts §7) (depends on T008, T024, T025).

**Checkpoint**: User Stories 1–5 all independently functional (quickstart.md scenario 6, sort portion).

---

## Phase 8: User Story 6 - Quick date filtering from the search surface (Priority: P3)

**Goal**: Relative date presets ("last day/week/month") and an explicit start/end range, per date/datetime attribute, reusing the entity's existing `~after`/`~before`/`~from`/`~until` search properties.

**Independent Test**: Choose a "last week" preset on a date field and confirm the list narrows to the last 7 days; pick an explicit range for the same field and confirm it replaces the preset; confirm a second date field's shortcut is unaffected.

### Implementation for User Story 6

- [x] T027 [P] [US6] Implement `date-range-shortcut.ts` in `packages/features/src/entity-search-bar/util/` + test: resolves a relative preset (`"last-day" | "last-week" | "last-month"`) to a concrete `{ from: Date; to: Date }` pair evaluated against the current local time (research D6/D7); pure function, no I/O (FR-021).
- [x] T028 [P] [US6] Add a per-date-attribute shortcut section (presets + explicit range inputs) to `search-suggestions-popover.tsx` (T006) and update its test/stories (FR-021, FR-022).
- [x] T029 [US6] In `entity-search-bar.tsx` (T008), for every date/datetime search property, wire the section from T028 to the entity's existing `~after`/`~before`/`~from`/`~until` properties via the SAME encode path `coerceFilterValue`/`applyFilterValues` (`packages/features/src/search/filter-properties.ts`) already use for manual date entry, ensuring one date field's shortcut never touches another's filter state (FR-023) (depends on T008, T024 [reuses the same `onFiltersChange` wiring pattern], T027, T028).

**Checkpoint**: All six user stories independently functional (quickstart.md scenario 6, date portion — full quickstart coverage complete).

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature verification once every desired story is in.

- [x] T030 [P] Review/update Playwright story snapshots for `search-suggestions-popover.stories.tsx` across all its accumulated variants (ADR-009).
- [x] T031 Type-check: `pnpm --filter @contentgrid/navigator-data exec tsc --noEmit -p .`, `pnpm --filter @contentgrid/features exec tsc --noEmit -p .`, `pnpm --filter @contentgrid/ui exec tsc --noEmit -p .`, `pnpm --filter navigator-experimental exec tsc --noEmit -p .`.
- [x] T032 Run the full automated suite: `npx vitest run --project navigator-data --project features --project ui`.
- [x] T033 Execute all 6 manual scenarios in [quickstart.md](./quickstart.md) against the `apps/navigator-experimental` dev server.
- [x] T034 [P] Lint every new/modified file (`eslint`) across `packages/navigator-data`, `packages/features`, `packages/ui`, `apps/navigator-experimental`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001) for the directory to exist — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T004, T005) only.
- **User Story 2 (Phase 4)**: Depends on Foundational AND on US1's files (T006, T008, T009) — it extends the same popover and view rather than creating new ones, so despite both being P1 it is sequential after US1, not parallel with it. This is a deliberate deviation from "stories should be parallel," justified because the spec itself frames US1+US2 as one inseparable P1 slice (US2's own "Why this priority": _"so it's part of the P1 slice, not a later enhancement"_).
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's route wiring (T010) — adds URL persistence to the query state US1 already introduced.
- **User Story 4 (Phase 6)**: Depends on Foundational and on US1's view (T008) — otherwise independent of US2/US3.
- **User Story 5 (Phase 7)**: Depends on Foundational and on US1's view (T008) — otherwise independent of US2/US3/US4.
- **User Story 6 (Phase 8)**: Depends on Foundational and on US1's view (T008) — otherwise independent of US2/US3/US4/US5.
- **Polish (Phase 9)**: Depends on every story that will ship being complete.

### Parallel Opportunities

- Within Foundational: T003, T004, T005 can run in parallel once T002 exists (T003 depends on T002; T004/T005 have no dependency on T002 at all and can start immediately).
- Within US1: T007 (popover test/stories) parallel with T009 (view test) once their respective implementation tasks (T006/T008) land; T006 and T008 themselves are sequential (T008 renders T006's component).
- Within US2: T012, T013, T014 are mutually parallel (different files); T015 depends on T014; T016 is independent of all three.
- Within US3: T017 parallel with nothing before it exists; T020 can be written in parallel with T019 once T017/T018 land.
- US4, US5, US6 can be staffed in parallel with each other once US1 (T008) is done — none of them depend on US2 or US3, or on each other.

---

## Parallel Example: Foundational Phase

```bash
# After T002 (the hook) exists:
Task: "MSW contract test in packages/navigator-data/src/hooks/collection/use-entity-search-suggestions.test.ts"
Task: "applySuggestionBudget + test in packages/features/src/entity-search-bar/util/suggestion-budget.ts"
Task: "selectEffectiveMatches + test in packages/features/src/entity-search-bar/util/effective-match-selection.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Extend use-entity-search-suggestions.test.ts with relation-traversal + budget cases"
Task: "Add attribute/relation-label display to search-suggestions-popover.tsx"
Task: "Add loading + error/retry states to search-suggestions-popover.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — the spec's own P1 slice)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T005) — CRITICAL, blocks everything else.
3. Complete Phase 3: User Story 1 (T006–T011).
4. Complete Phase 4: User Story 2 (T012–T016) — the spec treats US1+US2 as one P1 slice; don't stop at US1 alone for a demo.
5. **STOP and VALIDATE**: run quickstart.md scenarios 1–3 against `apps/navigator-experimental`.
6. Demo internally (never publicly — this feature is `experimental`, per Constitution IV / research D3).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 → full P1 MVP → validate → internal demo.
3. US3 (P2) → shareable URL state → validate.
4. US4, US5, US6 (P3) → can proceed in parallel with each other, in any order → validate each independently.
5. Polish (Phase 9) once the desired subset of stories is complete.

### Parallel Team Strategy

With multiple developers, once Foundational (Phase 2) and US1 (Phase 3) are both done:

- Developer A: User Story 2 (extends the same files US1 built)
- Developer B: User Story 3 (URL state)
- Developer C: User Story 4, then 5, then 6 (each touches `entity-search-bar.tsx` and the popover additively, but in different sections — coordinate merge order to avoid conflicting edits to the same two files)

---

## Notes

- [P] tasks touch different files and have no unmet dependency at the point they'd run.
- [Story] labels map every story-phase task back to spec.md's US1–US6 for traceability.
- US1 and US2 are sequential despite both being P1 (see Dependencies) — this is a deliberate, spec-justified exception to "stories should be parallel," not an oversight.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- `apps/navigator` is never touched by any task above (research D3) — only `apps/navigator-experimental`.
