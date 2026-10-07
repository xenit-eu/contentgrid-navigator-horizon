---
description: "Task list for the single search bar on the entity item collection page"
---

# Tasks: Single Search Bar for an Entity Item Collection

**Input**: Design documents from `specs/003-single-search-bar-entity-item-collection/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution requires them: MSW contract tests for every new or changed
hook, a story for every new or changed `packages/ui` component (ADR-009), and co-located Vitest
tests. Write each story's tests first and confirm they fail before implementing.

**Organization**: One phase per user story, in spec priority order: US1, US2, US3 (P1); US4, US5,
US7 (P2); US6, US8 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the spec user story the task serves
- Paths are repo-relative. Abbreviations used below:
  - **UI** = `packages/ui/src`
  - **ND** = `packages/navigator-data`
  - **FE** = `packages/features/src`
  - **SB** = `packages/features/src/entity-search-bar`

## Conventions every task follows

- **`packages/ui`**: plain props only; no `@contentgrid/hal*` imports; no entity concepts. Icons
  are passed in as `ReactNode`. Colours come from theme tokens, never hex literals. Export every
  new component from `UI/index.ts` (through `UI/primitives/index.ts` or `UI/patterns/index.ts`).
  Give every new or changed component a `*.stories.tsx` (`title: "Primitives/X"` or
  `"Patterns/X"`, `tags: ["autodocs"]`) and a co-located `*.test.tsx`. Behaviour checks go in
  one `WithInteraction` story tagged `no-visual-test`, with each popover sequence inside a single
  `step()`, queried via `within(document.body)`.
- **`packages/navigator-data`**: URLs only from `profileEntity.searchEntityRequest(values).url`.
  Values only through `createValues(template).withValue(...)`. Hooks reject with `Error`.
- **`packages/features`**: no Layer-1 imports. Fields come only from `resolveHalFormsFields`.
  Reshaping lives in `SB/util/*.ts` as pure functions, each with a sibling `*.test.ts`.
  Components consume ready-made models.
- **Commits**: each commit message cites the FR / user story it implements (Principle IX).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature skeleton and move existing helpers, with no visible change.

- [x] T001 Create the feature skeleton:
  - `SB/package.json` with `{ "name": "@contentgrid/features-entity-search-bar", "private": true, "x-stability": "stable" }`, copying the shape of `FE/search/package.json`
  - `SB/index.ts` exporting nothing yet
  - subpath export `"./entity-search-bar": { "import": "./src/entity-search-bar/index.ts", "types": "./src/entity-search-bar/index.ts" }` in `packages/features/package.json`, next to `"./entity-item-collection"`
- [x] T002 [P] Move the private helpers `emptyValueFor`, `filterFieldValues` and `encodeFilterValue` out of `FE/entity-item-collection/entity-item-collection-view.tsx` into a new `FE/search/filter-field-values.ts`:
  - Add `buildCollectionSearchValues(searchTemplate, fields, filters, currentSort?)`. It returns exactly what the view builds inline today: `applyFilterValues(createValues(searchTemplate.template), fields, filters)` plus `.withValue(searchTemplate.sortProperty.name, [currentSort])` when a sort is set.
  - Export all of them from `FE/search/index.ts`.
  - Make the view import them. Behaviour must not change.
  - Contract: contracts/features.md §2.
- [x] T003 [P] Add `FE/search/filter-field-values.test.ts`. Cover:
  - `Date` → ISO string
  - array → first element
  - `""` → `undefined`
  - number and boolean coercion round-trips through `filterFieldValues`
  - `buildCollectionSearchValues` with and without `currentSort`
- [x] T004 [P] Map the existing `--success`, `--success-border` and `--success-foreground` tokens into the `@theme inline` block of `UI/styles/preset.css`, as `--color-success`, `--color-success-border` and `--color-success-foreground`. `bg-success`, `border-success` and `text-success` must then work in light and dark. Add no new colour values (research R6).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The descriptor model, the test fixture, the shared prefix filter and the mounted
(empty) bar. Every user story depends on these.

**⚠️ CRITICAL**: No user-story work starts until this phase is complete.

### Fixture

- [x] T005 Add the MSW fixture `ND/test-fixtures/msw/search-bar-fixtures.ts`, built with the `profileAttribute({...})` helper from `ND/test-fixtures/msw/entity-browser-fixtures.ts`.
  - It defines a `search-bar` entity profile (plural href `/search-bars`) whose `_templates.search` has these properties:
    - `title~prefix`, plus `title` (exact)
    - `notes~fts`
    - `reference` (exact text)
    - `status` with inline options `draft` / `approved` / `rejected` and an `allowed-values` constraint
    - `quantity` (long) with `quantity`, `quantity~gte`, `quantity~lte`
    - `amount` (double) with `amount`, `amount~gte`, `amount~lte`
    - `due_date` (type `date`) with `due_date~from`, `due_date~until`
    - `received_at` (datetime) with `received_at~after`, `received_at~before`
    - `urgent` (checkbox)
    - `created_at` (datetime, constraint `created-date`) with `~after` / `~before`
    - `modified_at` (datetime, constraint `modified-date`) with `~after` / `~before`
    - `customer.name~prefix`
    - `owner.email~prefix`
    - `_sort`
  - Add matching `customer` and `owner` target profiles with `name~prefix` and `email~prefix`.
  - Export the profiles and a `searchBarHandlers` array.
- [x] T006 Extend `createListHandler` in `ND/test-fixtures/msw/handlers.ts` with two options:
  - `totals: "exact" | "estimate"`: when `"estimate"`, emit `page.total_items_estimate` and omit `total_items_exact`.
  - `resolveTotal(url: URL) => number`, so a test can answer a different total per query string.
  - Defaults must keep today's output unchanged. Add cases to `ND/test-fixtures/msw/handlers.test.ts`.

### Shared prefix filter (ui)

- [x] T007 [P] Add `filterOptionsByPrefix<T extends { label: string; value: string }>(options, query, limit?)` to a new `UI/lib/filter-options.ts`.
  - Matching is case- and accent-insensitive (NFD + strip combining marks).
  - It matches the start of `label`, then the start of any word inside `label`, then the start of `value`.
  - Order is stable; `limit` truncates.
  - An empty query returns all options (up to `limit`).
  - Export it from `UI/index.ts`. Contract: contracts/ui-primitives-and-patterns.md `filterOptionsByPrefix`.
- [x] T008 [P] Add `UI/lib/filter-options.test.ts`: prefix, word-start ("Approved by manager" / "man"), case, accents ("é" / "e"), value fallback, limit, empty query.

### Descriptor model (feature util)

- [x] T009 [P] Write `SB/util/build-search-param-descriptors.test.ts` against the T005 fixture. Assert one descriptor per resolved field, with:
  - `valueKind` and `mode` exactly as the table in research.md R2
  - `status` → `allowed-values`
  - `quantity` → `integer` and `amount` → `decimal`, from `ProfileAttribute.type` `long` / `double`
  - `created_at` → `auditRole: "created"` and `modified_at` → `auditRole: "modified"`, read from the constraints
  - `customer.name~prefix` → `relation: { name: "customer", ... }` and `valueKind` `text`, typed through the target attribute
  - no descriptor for `_sort` or hidden properties
- [x] T010 Extract `resolveRelationSearchTarget(searchProperty, profiles)` and `extractAttributeSuggestions(collection, attributeName, limit)` from `ND/src/hooks/collection/use-typeahead.ts` into a new `ND/src/hooks/collection/search-suggestion-helpers.ts`.
  - Signatures are in contracts/navigator-data.md §1–§2. `extractAttributeSuggestions` returns distinct, non-empty values in response order.
  - Make `useTypeahead` call them, with no behaviour change; its existing tests must stay green.
  - Export both from `ND/src/hooks/index.ts` and `ND/src/index.ts`.
- [x] T011 [P] Add `ND/src/hooks/collection/search-suggestion-helpers.test.ts`:
  - target resolved for `customer.name~prefix`
  - `undefined` for a direct property, and for a relation whose target profile is missing
  - dedupe, empty-value skipping and `limit` in `extractAttributeSuggestions`
- [x] T012 Implement `buildSearchParamDescriptors(fields, searchTemplate, profiles)` in `SB/util/build-search-param-descriptors.ts` so T009 passes. Types are in data-model.md §2: `SearchParamDescriptor`, `SearchValueKind`, `SearchMode`.
  - **`valueKind`**:
    - inline options → `allowed-values`
    - `checkbox` → `boolean`
    - `date` → `date`
    - `datetime` / `datetime-local` → `datetime`
    - `number` → `integer` when the (target) attribute type is `long`, `decimal` when `double`
    - otherwise `text`
  - **`mode`**: maps 1:1 from `ProfileAttributeSearchType`, except that `allowed-values` overrides `exact`.
  - **`auditRole`**: "only from `ProfileAttribute.isCreatedDate` / `isModifiedDate` — never names", direct attributes only.
  - Relation targets are resolved with `resolveRelationSearchTarget` (T010).
- [x] T013 Implement `useEntitySearchBar` in `SB/use-entity-search-bar.ts`, with only the foundation for now:
  - memoise `profileEntity.searchTemplate` and `resolveHalFormsFields(searchTemplate)` once per `profileEntity` (research R1)
  - read `useProfileEntities()` for relation targets
  - build descriptors with T012
  - expose an internal `setParams(patch: Record<string, string | undefined>)` that builds the complete next map from `filters` (dropping keys whose value is `undefined` or `""`) and calls `onFiltersChange` once
  - Interface shape: contracts/features.md §1.
- [x] T014 Create `SB/entity-search-bar.tsx` with `EntitySearchBar({ profileEntity, filters, onFiltersChange, currentSort, className })`, following contracts/features.md §1:
  - It renders a vertical stack of three row slots (chips, main bar, quick filters). Each slot renders nothing yet.
  - It returns `null` when all three are empty.
  - Export `EntitySearchBar` and `EntitySearchBarProps` from `SB/index.ts`.
- [x] T015 Mount `<EntitySearchBar profileEntity={profile} filters={filters} onFiltersChange={onFiltersChange} currentSort={currentSort} />` in `FE/entity-item-collection/entity-item-collection-view.tsx`:
  - as its own `shrink-0 px-4` row between the `PageTitle` block and the table container, outside `tableActions`, so it stays visible while the table loads or errors
  - leave the existing "Columns" popover and "Filters" button/dialog unchanged (FR-033)

### Quick-filter scaffolding (shared by US4, US5, US6, US7)

- [x] T016 [P] Create the `FilterButton` primitive in `UI/primitives/filter-button.tsx`, per contracts/ui-primitives-and-patterns.md `FilterButton`:
  - Props: `icon?`, `label`, `tone?: "idle" | "active" | "positive" | "negative"`, `onClear?`, `clearLabel?` (default `` `Clear ${label} filter` ``), and `ref` usable as `<PopoverTrigger asChild>`.
  - Outlines by tone: idle `border-border`, active `border-ring`, positive `border-success`, negative `border-destructive`.
  - When `onClear` is set and tone ≠ `idle`, render the × as a **sibling** `<button>`, not nested in the trigger.
  - Do not set `aria-pressed`.
  - Export it from `UI/primitives/index.ts`.
- [x] T017 [P] Add `UI/primitives/filter-button.test.tsx`:
  - each tone's class
  - the × is rendered only when it should be
  - the × click calls `onClear` and not the trigger's `onClick`
  - works as a `PopoverTrigger asChild` (opens a popover)
- [x] T018 [P] Add `UI/primitives/filter-button.stories.tsx` with stories `Idle`, `Active`, `Positive`, `Negative`, `ActiveWithClear` and `LongLabel`, all with Phosphor icons.
- [x] T019 [P] Write `SB/util/build-quick-filters.test.ts` against the T005 fixture. Assert:
  - one `QuickFilterModel` per **direct** attribute (`groupKey`): date `due_date` (`includesTime: false`), date `received_at` (`includesTime: true`), number `quantity` (integer), number `amount` (decimal), boolean `urgent`, allowed-values `status`
  - audit date models `created_at` / `modified_at` last, with `auditRole`
  - no model for `customer.*` / `owner.*`
  - `isActive` true when any of the model's params has a non-empty value
  - `tone` follows data-model.md §7 (boolean: `"true"` → positive, `"false"` → negative)
- [x] T020 Implement `buildQuickFilters(descriptors, filters)` in `SB/util/build-quick-filters.ts` so T019 passes. Types `QuickFilterModel` and `QuickFilterState` are in data-model.md §7.
  - Use one exhaustive `switch` on `valueKind` with a `never` default. This is the deviation logged in plan.md Complexity Tracking; add a comment pointing there.
  - Rules: direct included descriptors only, grouped by `groupKey`, in profile order, audit dates last.
- [x] T021 Create `SB/components/search-icons.tsx`, the presentation map:
  - by `valueKind` / `mode`: prefix `TextAaIcon`, full-text `MagnifyingGlassIcon`, exact `EqualsIcon`, allowed-values `ListChecksIcon`, integer and decimal `HashIcon`, date `CalendarIcon`, datetime `ClockIcon`, boolean `ToggleLeftIcon`
  - audit: created `CalendarPlusIcon` (falling back to `CalendarIcon` if not in Phosphor 2.1.10), modified `PenIcon`
  - boolean values: true `CheckCircleIcon`, false `XCircleIcon` (the same icons as `FE/entity-item/attributes/renderers/boolean-attribute-renderer.tsx`)
  - All from `@phosphor-icons/react`; size 14; `aria-hidden`.
- [x] T022 Create `SB/components/quick-filter-row.tsx`:
  - a horizontal `ScrollArea` with `<ScrollBar orientation="horizontal" />` from `@contentgrid/ui`, no wrapping (FR-031)
  - a render slot per `QuickFilterModel.kind`; until the story phases fill them, each slot renders nothing
  - wire it into the third row of `SB/entity-search-bar.tsx`
  - extend `useEntitySearchBar` with `quickFilters`, `applyQuickFilter(groupKey, values)` and `clearQuickFilter(groupKey)` (removes every param of that model)

**Checkpoint**: the bar is mounted and renders nothing visible, `pnpm typecheck && pnpm lint && pnpm test` is green, and user stories can start.

---

## Phase 3: User Story 1 - Search across every attribute from one input (Priority: P1) 🎯 MVP

**Goal**: typing in "All" mode opens a popover with parameter chips (with counts) and grouped
suggestions (≤ 10 per parameter); clicking a suggestion applies it.

**Independent Test**: on the `search-bar` fixture (or a real entity with two prefix/full-text
attributes), type a value present in one attribute. The popover shows its chip with a count and a
group of values; clicking a value narrows the list, clears the input and resets the selector to
"All" (spec US1).

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [x] T023 [P] [US1] Add the MSW contract test `ND/src/hooks/collection/use-search-param-suggestions.test.tsx`, using `searchBarHandlers` (T005) and the T006 options. Cover:
  - direct prefix param → exactly one request, suggestions + exact `totalItems`
  - `totals: "estimate"` → `isEstimated: true`
  - relation param `customer.name~prefix` → two requests: suggestions from `/customers`, count from `/search-bars` with the param
  - active `searchValues` are carried into the count request URL
  - server 500 → `status: "error"`, then `refetch()` re-requests
  - query shorter than `minLength` → `idle` and no request
  - changing the query while a request is in flight never yields the old query's suggestions under the new query
- [x] T024 [P] [US1] Add `SB/util/classify-search-input.test.ts` and `SB/util/select-param-chips.test.ts` (data-model.md §4):
  - `""` → empty, `"12"` → integer, `"-3"` → integer, `"12.5"` and `"12,5"` → decimal, `"abc"` → text
  - text input hides integer/decimal chips
  - integer input lists integer + decimal first, then text + allowed-values
  - decimal input excludes integer chips
- [x] T025 [P] [US1] Add `SB/util/build-suggestion-models.test.ts` (data-model.md §5):
  - hook results → `ParamChipModel[]` / `SuggestionGroupModel[]`
  - unsearched params (exact text, integer, decimal) → count `{ status: "unknown" }`
  - loading → `{ status: "loading" }`
  - error → group `status: "error"` with `retry`
  - allowed-values group filtered client-side via `filterOptionsByPrefix`, max 10
  - every group capped at 10 items (FR-015)
- [x] T026 [P] [US1] Add `UI/patterns/search-suggestions-popover/search-suggestions-popover.test.tsx`:
  - renders chips with `CountIndicatorChip` (`null` → "?", estimated → "~")
  - group headers with counts
  - per-group loading / empty / error+Retry, while other groups still render
  - ArrowDown/ArrowUp walk chips then items and wrap; ArrowLeft/Right move within chips; Enter calls `onSelectChip` / `onSelectItem`; Escape calls `onOpenChange(false)`
  - ARIA: `role="combobox"`, `aria-activedescendant` and `role="option"` wiring

### Implementation for User Story 1

- [x] T027 [P] [US1] Extend `CountIndicatorChip` in `UI/primitives/count-indicator-chip.tsx`:
  - add `isLoading?: boolean`, rendered as a pulse placeholder with `aria-busy="true"`
  - when `isEstimated`, set `aria-label` to "about N results"
  - add `Loading` and `Estimated` stories to its `*.stories.tsx` and cases to its test
- [x] T028 [P] [US1] Extend `SelectionChip` in `UI/primitives/selection-chip.tsx` with an optional leading `icon?: ReactNode` and an optional `trailing?: ReactNode`. Existing usages must render unchanged. Add a `WithIconAndCount` story and a test.
- [x] T029 [US1] Build the `SearchSuggestionsPopover` pattern in `UI/patterns/search-suggestions-popover/search-suggestions-popover.tsx`, exactly per contracts/ui-primitives-and-patterns.md `SearchSuggestionsPopover`:
  - `Popover` + `PopoverAnchor` around the passed `anchor`
  - top row `role="listbox" aria-orientation="horizontal"` of `SelectionChip` (icon + label + `CountIndicatorChip`)
  - groups as `role="group"` with headers showing `CountIndicatorChip`
  - controlled `activeId`
  - does not close on interaction inside the anchor (same rule as `UI/patterns/autocomplete-renderer.tsx`)
  - Export the pattern, its types and the `useSuggestionsKeyboard(chips, groups, { activeId, onActiveIdChange, onSelectChip, onSelectItem, onEscape })` helper (returns the input `onKeyDown`) from `UI/patterns/search-suggestions-popover/index.ts` and `UI/patterns/index.ts`.
  - Make T026 pass.
- [x] T030 [P] [US1] Add `UI/patterns/search-suggestions-popover/search-suggestions-popover.stories.tsx` with `Default` (chips + three groups), `UnknownCounts` ("?"), `Loading`, `NoMatches`, `GroupError` (one group in error, others ready) and `NumbersFirst`.
  - Add `search-suggestions-popover.interaction.stories.tsx`, same `title`, no `autodocs`, holding only `WithInteraction` (tag `no-visual-test`): arrows through chips and items, Enter selects, Escape closes, all in one `step()`.
- [x] T031 [US1] Implement `useSearchParamSuggestions` in `ND/src/hooks/collection/use-search-param-suggestions.ts`, per contracts/navigator-data.md §3:
  - `useQueries` over `requests`; the query is debounced 250 ms with `ND/src/hooks/use-debounced-value.ts`; `minLength` default 1, `limit` default 10
  - count request = `searchValues.withValue(param, coercedQuery)` on the current entity, via `profileEntity.searchEntityRequest(values).url` and `EntityItemCollection.fetchByUrlQuery`
  - direct params take suggestions from the same response (`extractAttributeSuggestions`)
  - relation params make an extra request on the target entity with only `targetParam = query` (via `resolveRelationSearchTarget`)
  - a number-typed param whose query cannot be coerced → `idle`, no request
  - query options: `staleTime` 30 s, `gcTime` 60 s, `retry: 0`, no `placeholderData`
  - Add `queryKeys.searchParamSuggestions.byUrl(profileEntity, url) = ["SearchParamSuggestions", profileEntity.name, url]` to `ND/src/query-keys.ts`, under the per-entity invalidation prefix.
  - Export it from `ND/src/hooks/index.ts` and `ND/src/index.ts`. Make T023 pass.
- [x] T032 [P] [US1] Implement `classifySearchInput(raw)` in `SB/util/classify-search-input.ts`:
  - trims the input
  - `/^-?\d+$/` → `integer`, `/^-?\d*[.,]\d+$/` → `decimal`, otherwise `text` (or `empty`)
  - also export `normaliseNumberInput` (`,` → `.`)
  - Make the first half of T024 pass.
- [x] T033 [P] [US1] Implement `selectParamChips(descriptors, inputClass, mode)` in `SB/util/select-param-chips.ts`:
  - Only descriptors with `valueKind ∈ {text, allowed-values, integer, decimal}` and `mode ∈ {prefix, full-text, exact, allowed-values}`.
  - Order and filtering per the data-model.md §4 table.
  - `mode.kind === "all-direct"` drops descriptors with a `relation`.
  - Make the second half of T024 pass.
- [x] T034 [US1] Implement `buildSuggestionModels(descriptors, chips, hookResults, query, mode)` in `SB/util/build-suggestion-models.ts`:
  - produces `ParamChipModel[]`, with `CountState` per data-model.md §5
  - produces `SuggestionGroupModel[]`: one group per searched prefix / full-text param and per allowed-values param (allowed-values via `filterOptionsByPrefix`), each capped at 10, in descriptor order
  - Make T025 pass.
- [x] T035 [US1] Extend `useEntitySearchBar` (`SB/use-entity-search-bar.ts`) with the input state:
  - `value`, `setValue`, `popoverOpen` (opens at ≥ 1 trimmed character in all/all-direct mode)
  - selector `mode`, initially `{ kind: "all" }`
  - `searchValues` from `buildCollectionSearchValues` (T002)
  - `useSearchParamSuggestions` requests = the included prefix / full-text descriptors (in all mode)
  - `paramChips` and `groups` from T034
  - `applySuggestion(paramName, value)`: calls `setParams({ [paramName]: value })` (one value per parameter, replacing any existing one), clears the input, resets the mode to `all` and closes the popover (FR-019)
- [x] T036 [US1] Create `SB/components/search-input.tsx`:
  - an `Input` with `role="combobox"`, rendered as the `anchor` of `SearchSuggestionsPopover`
  - wires `useSuggestionsKeyboard`; Enter with a highlighted entry applies it; Enter with nothing highlighted calls `submit` (a no-op in all mode for now); Escape closes
  - placeholder "Search…"
  - put it in the second row of `SB/entity-search-bar.tsx`
  - The selector column stays empty until US2.

**Checkpoint**: US1 works on its own in the running app (quickstart §4 step 1–2), and every US1 test is green.

---

## Phase 4: User Story 2 - Search on one chosen parameter (Priority: P1)

**Goal**: the selector lets the user pick "All", "All except relations" or one parameter. In
parameter mode the popover shows only that parameter's suggestions, and Enter applies the typed
text.

**Independent Test**:

- Pick an integer parameter, type `42` and press Enter → it is applied; type `abc` → inline error and no filter.
- Pick a prefix parameter → only its suggestions show.
- Pick "All except relations" → no relation chips or groups (spec US2).

### Tests for User Story 2 ⚠️

- [x] T037 [P] [US2] Add `SB/util/build-selector-groups.test.ts`:
  - the first group has no label and holds "All" and "All except relations"
  - then the entity's own params (text, allowed-values, integer exact, decimal exact), then one group per relation in profile order, labelled with the relation title
  - each option has a `modeLabel` ("Prefix", "Full text", "Exact", "One of", "Integer", "Decimal")
  - no date / boolean / range options (FR-007, FR-009)
- [x] T038 [P] [US2] Add `UI/patterns/grouped-select.test.tsx`: groups with and without headers, separators, icon + hint rendered in options and trigger, keyboard selection, `onValueChange`.
- [x] T039 [P] [US2] Add `SB/use-entity-search-bar.test.tsx` (`renderHook` with MSW `searchBarHandlers`). Cover:
  - **param mode prefix**: only that param is requested
  - **param mode allowed-values**: suggestions are client-filtered and only a count request is made
  - **param mode exact / integer / decimal**: `popoverOpen` stays false
  - **submit (Enter)**:
    - with `quantity` selected and value `"42"` → `onFiltersChange` with `quantity: "42"`, input cleared, mode reset to all
    - with value `"4.2"` on an integer param → `error` set and `onFiltersChange` not called
    - with a prefix param and no highlighted suggestion → the typed text is applied as the prefix value
  - **all-direct**: relation params are neither requested nor shown

### Implementation for User Story 2

- [x] T040 [P] [US2] Create the `GroupedSelect` pattern in `UI/patterns/grouped-select.tsx`, per contracts/ui-primitives-and-patterns.md `GroupedSelect`:
  - built on `Select`, `SelectGroup`, `SelectLabel` and `SelectSeparator`
  - the trigger shows the selected option's icon, label and hint
  - `size` `sm` / `default`
  - Export it from `UI/patterns/index.ts`. Add `UI/patterns/grouped-select.stories.tsx` (`Default`, `WithRelations`, `Small`). Make T038 pass.
- [x] T041 [US2] Implement `buildSelectorGroups(descriptors, profileEntity)` in `SB/util/build-selector-groups.ts`, returning `SelectorGroup[]` per data-model.md §3. Use option value `"__all__"` for all mode, `"__all_direct__"` for all-direct, and the descriptor `name` otherwise. Make T037 pass.
- [x] T042 [US2] Create `SB/components/search-param-selector.tsx`:
  - wraps `GroupedSelect` with icons from `search-icons.tsx` and the accessible name "Search in"
  - maps option values to `SelectorMode`
  - is the first column of the second row in `SB/entity-search-bar.tsx`, before `search-input.tsx`
- [x] T043 [US2] Extend `useEntitySearchBar` (`SB/use-entity-search-bar.ts`) for parameter mode. Make T039 pass.
  - **`selectParam(name)`**: from a popover chip; sets mode `{ kind: "param", name }` and keeps the input.
  - **Requests by mode**:
    - prefix / full-text → only that param
    - allowed-values → `withSuggestions: false` count request plus client-filtered suggestions
    - exact / integer / decimal → no request and no popover (FR-018)
  - **`submit()`**:
    - in param mode, coerce the typed text with `coerceFilterValue(descriptor.field.property.type, normaliseNumberInput(value))`
    - integer params also require `Number.isInteger`
    - on failure set `error` to "Enter a whole number" / "Enter a number" and apply nothing (FR-020)
    - on success call `setParams({ [name]: value })`, clear the input and reset the mode to all
    - in all / all-direct mode do nothing (research R9)
  - **all-direct mode**: drop relation descriptors everywhere (FR-021).
- [x] T044 [US2] In `SB/components/search-input.tsx`:
  - show `error` under the input (`aria-describedby`, `aria-invalid`), and clear it on the next keystroke
  - Escape on a closed popover resets the mode to all
  - Backspace on an empty input in param mode resets the mode to all (research R9, droppable)
  - clicking a chip in the popover calls `selectParam`

**Checkpoint**: US1 + US2 work (quickstart §4 steps 1–3).

---

## Phase 5: User Story 3 - See and remove active filters (Priority: P1)

**Goal**: every active filter (from any source) shows as a chip with field, mode and value;
closing it removes the filter at once. The row is at most two lines, then scrolls sideways.

**Independent Test**: apply two filters (from the bar, the dialog or the URL); both chips show
their mode; closing one updates the list immediately. A date range is one chip; many filters →
two lines, then horizontal scroll (spec US3).

### Tests for User Story 3 ⚠️

- [x] T045 [P] [US3] Add `SB/util/build-active-filter-chips.test.ts` (data-model.md §6). Cover:
  - one chip per non-range param, with `mode` "prefix" / "full text" / "is" / "one of"
  - `received_at~after` + `received_at~before` → one chip, id `received_at`, `mode: "between"`, `paramNames` both
  - only `quantity~gte` → `mode: "≥"`
  - an allowed value is shown by its option prompt
  - a boolean `"true"` gets `valueIcon` set
  - an empty-string value produces no chip
  - an unknown key `s.legacy` → `isUnresolved: true`, showing the raw key and value, placed last
  - chips follow descriptor order
- [x] T046 [P] [US3] Add `SB/util/format-filter-value.test.ts`:
  - date (`YYYY-MM-DD`) and datetime (ISO) formatted with `Intl.DateTimeFormat` in a fixed test locale
  - number formatting
  - allowed-value prompt lookup with raw fallback
  - booleans "True" / "False"
- [x] T047 [P] [US3] Rewrite `UI/patterns/filter-chips/filter-chips.test.tsx` for the new props:
  - `chips[]` render `Chip` with mode and value
  - × calls `onRemove(id)`
  - empty `chips` renders nothing (no reserved height)
  - the overflow container has the two-line max height with horizontal scrolling
  - focusing a chip scrolls it into view
- [x] T048 [P] [US3] Extend `UI/primitives/chip.test.tsx` (create it if absent):
  - `mode` segment rendered between field and value
  - `modeIcon` / `valueIcon` rendered
  - `removeLabel` default `` `Remove ${field} ${label} filter` ``
  - old props without the new fields render as before

### Implementation for User Story 3

- [x] T049 [P] [US3] Extend `Chip` in `UI/primitives/chip.tsx`, per contracts/ui-primitives-and-patterns.md `Chip`:
  - add `mode?`, `modeIcon?`, `valueIcon?` and `removeLabel?`
  - the mode is always visible as a muted segment; the value truncates with a `Tooltip` when long
  - replace the hex colours with tokens (applied → `bg-accent border-ring/40`, neutral → `bg-background border-border`) in light and dark
  - update `UI/primitives/chip.stories.tsx` (create it if absent) with `WithMode`, `WithValueIcon` and `LongValue`
  - Make T048 pass.
- [x] T050 [US3] Rewrite `UI/patterns/filter-chips/filter-chips.tsx`:
  - props `{ chips: readonly FilterChipItem[]; onRemove(id); maxLines?: 1 | 2; className? }`, per contracts/ui-primitives-and-patterns.md `FilterChips`
  - a `Chip tone="applied" removable` per item
  - wraps up to `maxLines` lines (default 2), then scrolls horizontally via `ScrollArea` with a horizontal `ScrollBar`
  - `scrollIntoView({ block: "nearest", inline: "nearest" })` on chip focus
  - Delete `UI/patterns/filter-chips/search-property-utils.ts` and the `SearchProperty` type. First confirm with a repo-wide search that nothing outside `filter-chips/` imports them (research R6: no consumers).
  - Update `UI/patterns/filter-chips/index.ts` and `filter-chips.stories.tsx` (`OneLine`, `TwoLines`, `Overflow`, `Empty`). Make T047 pass.
- [x] T051 [P] [US3] Implement `formatFilterValue(descriptor, raw, locale?)` in `SB/util/format-filter-value.ts`. Make T046 pass.
- [x] T052 [US3] Implement `buildActiveFilterChips(descriptors, filters)` in `SB/util/build-active-filter-chips.ts`, returning `ActiveFilterChipModel[]` per data-model.md §6:
  - merge the range params of one `groupKey`
  - mark keys that are not in `descriptors` as unresolved; also check with `findInvalidFilterKeys` from `FE/search`
  - order by descriptor order, unresolved last
  - Make T045 pass.
- [x] T053 [US3] Extend `useEntitySearchBar` with `chips` (from T052; built from **all** descriptors, before inclusion filtering, so excluded attributes still show — FR-037) and `removeChip(id)`, which calls `setParams` with every `paramNames` entry set to `undefined`.
  - Render `FilterChips` in the first row of `SB/entity-search-bar.tsx`, mapping `modeIcon` / `valueIcon` from `search-icons.tsx`.

**Checkpoint**: all P1 stories work; this is the MVP release candidate (quickstart §4 steps 1–4).

---

## Phase 6: User Story 4 - Quick filter on dates and audit dates (Priority: P2)

**Goal**: each date / datetime attribute and the created / modified audit dates get a quick
filter whose popover has a range calendar, presets, Clear and Apply.

**Independent Test**: open `due_date`'s quick filter, choose "Last week" and Apply → the list
narrows and the button turns blue with ×; Clear removes the filter; created / modified show their
own icons (spec US4).

### Tests for User Story 4 ⚠️

- [x] T054 [P] [US4] Add `SB/util/date-presets.test.ts`, using a fixed `now` (`2026-10-07T10:00:00` local):
  - last-day / last-week / last-month / last-year starts (−24 h, −7 days, −1 calendar month, −1 calendar year); end = now
  - datetime model → ISO strings on the `~after` / `~before` params
  - date model with `~from` / `~until` → `YYYY-MM-DD` inclusive
  - date model with only `~after` / `~before` → bounds shifted by one day so the range stays inclusive
  - a custom `{from, to}` range uses the same encoding
- [x] T055 [P] [US4] Add `UI/patterns/date-range-filter.test.tsx`:
  - the range calendar selects from/to through `onValueChange`
  - clicking a preset calls `onPresetSelect(id)` and marks it active
  - Apply / Clear call their handlers
  - stacked layout class at narrow width

### Implementation for User Story 4

- [x] T056 [P] [US4] Create the `DateRangeFilter` pattern in `UI/patterns/date-range-filter.tsx`, per contracts/ui-primitives-and-patterns.md `DateRangeFilter`:
  - `Calendar mode="range"` on the left, presets list on the right, footer with Clear (ghost) and Apply (default)
  - `numberOfMonths` defaults to 1; stacks vertically below `sm`
  - Export it from `UI/patterns/index.ts`. Add `UI/patterns/date-range-filter.stories.tsx` (`Empty`, `WithRange`, `PresetActive`). Make T055 pass.
- [x] T057 [US4] Implement `resolveDatePreset(id, now, model)` and `encodeDateRange({from, to}, model)` in `SB/util/date-presets.ts`, returning `Record<paramName, string | undefined>` per data-model.md §8. Presets are evaluated when Apply is clicked, in local time, with inclusive bounds. Make T054 pass.
- [x] T058 [US4] Create `SB/components/date-quick-filter.tsx`:
  - `FilterButton` (icon from `search-icons.tsx`: `auditRole` created / modified icons, else date / datetime) as `PopoverTrigger`
  - `PopoverContent` holding `DateRangeFilter` with draft state, seeded from the current filter values
  - Apply → `applyQuickFilter(groupKey, encodeDateRange(...))` and close
  - Clear → `clearQuickFilter(groupKey)` and close
  - `tone` and `onClear` from the model state
  - Presets "Last day", "Last week", "Last month" and "Last year" (FR-026, FR-027)
  - Register it in `SB/components/quick-filter-row.tsx` for `kind === "date"`.

**Checkpoint**: US4 works on its own (quickstart §4 step 5, date part).

---

## Phase 7: User Story 5 - Quick filter on booleans (Priority: P2)

**Goal**: one-click tri-state boolean quick filters with green / red / grey outlines and true /
false icons.

**Independent Test**: click `urgent` three times → the filter is true (green), then false (red),
then unset (grey), and the list follows (spec US5).

### Tests for User Story 5 ⚠️

- [x] T059 [P] [US5] Add `SB/components/boolean-quick-filter.test.tsx`:
  - unset → click → `onFiltersChange` with `urgent: "true"` → click → `"false"` → click → key removed
  - tone is idle / positive / negative at each step
  - the accessible name includes the state ("Urgent: true")
  - the true / false icon is rendered (colour is not the only signal)

### Implementation for User Story 5

- [x] T060 [US5] Add `cycleBoolean(groupKey)` to `useEntitySearchBar`: unset → `"true"` → `"false"` → unset, through `setParams` (FR-028).
- [x] T061 [US5] Create `SB/components/boolean-quick-filter.tsx`:
  - a `FilterButton` with no popover; `onClick={cycleBoolean}`
  - `tone` positive / negative / idle
  - `icon` = `CheckCircleIcon` / `XCircleIcon` when set, else the boolean type icon
  - `label` `${label}` plus a visually hidden state suffix
  - `onClear` only when set
  - Register it in `quick-filter-row.tsx` for `kind === "boolean"`. Make T059 pass.

**Checkpoint**: US5 works on its own (quickstart §4 step 5, boolean part).

---

## Phase 8: User Story 7 - Quick-filter active state (Priority: P2)

**Goal**: a quick filter shows the blue outline and × whenever its attribute is filtered,
whatever set it; × clears every param of that attribute.

**Independent Test**: set `received_at~after` through the advanced filter dialog → the
`received_at` quick filter turns blue with ×; clicking × removes the filter without opening the
popover (spec US7).

### Tests for User Story 7 ⚠️

- [x] T062 [P] [US7] Add `SB/entity-search-bar.test.tsx`, rendering `EntitySearchBar` with MSW `searchBarHandlers`:
  - with `filters = { "received_at~after": "2026-10-01T00:00:00.000Z" }` the `received_at` button has the active tone and an × labelled "Clear Received at filter"
  - clicking × calls `onFiltersChange({})` and opens no popover
  - same for a `quantity~gte` filter and an allowed-value `status` filter
  - boolean keeps the positive / negative tones, not blue

### Implementation for User Story 7

- [x] T063 [US7] Verify and, where needed, complete `SB/components/quick-filter-row.tsx` and each quick-filter component so that `isActive` and `tone` come only from `buildQuickFilters(descriptors, filters)`, never from component state, and every non-boolean quick filter passes `onClear={() => clearQuickFilter(groupKey)}` when active (FR-025). Make T062 pass.

**Checkpoint**: all P2 stories work (quickstart §4 step 5).

---

## Phase 9: User Story 6 - Quick filter on numbers and allowed values (Priority: P3)

**Goal**: number quick filters (exact, then Min / Max, then Clear / Apply) and allowed-values
quick filters (search box above the list).

**Independent Test**: set Min / Max on `quantity` and Apply → the list narrows to the range. On
`status`, type "app" → only "approved" remains; pick it → the list filters (spec US6).

### Tests for User Story 6 ⚠️

- [x] T064 [P] [US6] Add `UI/patterns/searchable-option-list.test.tsx`:
  - typing filters through `filterOptionsByPrefix` on every keystroke with no debounce
  - arrow keys and Enter select; `onValueChange` is called
  - `emptyLabel` is shown when nothing matches
  - `autoFocus` focuses the search input
- [x] T065 [P] [US6] Add `SB/components/number-quick-filter.test.tsx`:
  - the popover renders `quantity`, `quantity~gte` and `quantity~lte` through `HalFormsContainer`, with exact on its own row and min / max side by side (the `generateSearchFormLayout` pairing)
  - Apply calls `applyQuickFilter` with only the filled-in params
  - Clear removes all three
  - the draft is seeded from the current filters and not applied before Apply
- [x] T066 [P] [US6] Add `SB/components/allowed-values-quick-filter.test.tsx`:
  - the popover shows `SearchableOptionList` with the `status` options (labels = prompts)
  - picking "approved" applies `status: "approved"` and closes
  - the active tone shows when `status` is set

### Implementation for User Story 6

- [x] T067 [P] [US6] Create the `SearchableOptionList` pattern in `UI/patterns/searchable-option-list.tsx`, per contracts/ui-primitives-and-patterns.md `SearchableOptionList`:
  - an `Input` above a `role="listbox"` single-select list
  - filtered with `filterOptionsByPrefix` (T007)
  - Export it from `UI/patterns/index.ts`. Add `UI/patterns/searchable-option-list.stories.tsx` (`Default`, `Filtered`, `NoMatches`). Make T064 pass.
- [x] T068 [US6] Create `SB/components/number-quick-filter.tsx`:
  - `FilterButton` + `Popover`
  - the content renders the model's `fieldNames` through `HalFormsContainer` (from `FE/hal-forms`), using the subset of `fields` and a layout from `generateSearchFormLayout` restricted to those fields
  - draft state comes from `useHalFormsFieldState({ fields: subset, initialValues: filterFieldValues(subset, filters) })` (T002); do not add a field-state hook or kind switch (plan.md Complexity Tracking)
  - footer: Clear (`clearQuickFilter`) and Apply, which applies `encodeFilterValue` per field via `applyQuickFilter`, with empty fields → `undefined`
  - Register it in `quick-filter-row.tsx` for `kind === "number"`. Make T065 pass.
- [x] T069 [US6] Create `SB/components/allowed-values-quick-filter.tsx`: `FilterButton` + `Popover` + `SearchableOptionList` (`autoFocus`, options from the model); selecting applies `{ [param]: value }` and closes. Register it for `kind === "allowed-values"`. Make T066 pass.

**Checkpoint**: US6 works on its own (quickstart §4 step 5, number and allowed-values parts).

---

## Phase 10: User Story 8 - Choose which attributes take part in search (Priority: P3)

**Goal**: inclusion per attribute, resolved user preference → backend default → "all", edited
on the entity configuration page next to "Visible columns". Relation params are always
included.

**Independent Test**: untick `reference` under "Searchable attributes" → it disappears from the
selector, popover and quick filters; `customer.name~prefix` stays; a URL filter on `reference`
still shows as a chip (spec US8).

### Tests for User Story 8 ⚠️

- [x] T070 [P] [US8] Extend the schema tests in `ND/src/accessors/entity-display-preferences.test.ts` (create it if absent):
  - `searchAttributes` accepts `string[]` and rejects non-arrays
  - `ProfileEntity.getDefaultPreferences()` leaves it `undefined`
- [x] T071 [P] [US8] Add `FE/preferences/use-search-attribute-inclusion.test.tsx`:
  - no layers → `"all"`
  - a user override array wins over a backend array
  - a higher-layer array **replaces** a lower one (assert against the real `deepMerge`, research R8)
  - unknown names are ignored by `isIncluded`
- [x] T072 [P] [US8] Add `SB/util/apply-search-inclusion.test.ts`:
  - `"all"` keeps everything
  - a set drops every descriptor of excluded direct attributes, including all range params of that `groupKey`
  - relation descriptors are never dropped (FR-036)
- [x] T073 [P] [US8] Extend `FE/preferences/views/entity-configuration-detail.test.tsx`:
  - a "Searchable attributes" multi-select lists direct attributes with at least one search param, audit attributes as system options
  - toggling calls `setOverride({ searchAttributes })`

### Implementation for User Story 8

- [x] T074 [US8] Add `searchAttributes: z.array(z.string()).optional()` to `entityDisplayPreferencesSchema` in `ND/src/accessors/entity-display-preferences.ts`. Do not set it in `ProfileEntity.getDefaultPreferences()` (`ND/src/accessors/entity-profile.ts`). Make T070 pass.
- [x] T075 [US8] Implement `useSearchAttributeInclusion(profileEntity)` in `FE/preferences/use-search-attribute-inclusion.ts`, returning `{ includedAttributes: ReadonlySet<string> | "all"; isIncluded(name) }` from `useEntityDisplayPreferences`. Export it from `FE/preferences/index.ts`. If T071 shows `deepMerge` concatenating arrays, fix `deepMerge` to replace arrays in the same task and note it in the commit. Make T071 pass.
- [x] T076 [US8] Implement `applySearchInclusion(descriptors, included)` in `SB/util/apply-search-inclusion.ts`. Make T072 pass.
  - In `useEntitySearchBar`, apply it to the descriptors feeding the selector, the suggestion requests and `buildQuickFilters`.
  - Do **not** apply it to chips (FR-037).
- [x] T077 [US8] In `FE/preferences/views/entity-configuration-detail.tsx`, add an `AttributeMultiSelect` labelled "Searchable attributes" directly below "Visible columns":
  - options are the direct attributes with `searchParams.length > 0`, built with `toAttributeOption`; audit attributes are passed as `isSystem`
  - `values` = `preferences.searchAttributes` ?? every option name
  - `onChange` → `setOverride({ searchAttributes: [...names] })` (FR-035a)
  - Make T073 pass.

**Checkpoint**: every user story works on its own.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [x] T078 [P] Responsive pass on `SB/entity-search-bar.tsx` and the quick-filter popovers at ≈ 375 px:
  - selector and input stay on one row (the selector collapses to its icon below `sm`)
  - the chip and quick-filter rows scroll horizontally
  - `DateRangeFilter` stacks
- [x] T079 [P] Accessibility pass: keyboard-only walkthrough of quickstart §4 steps 1 and 3. Run `pnpm test:a11y` and fix violations in the touched `packages/ui` components.
- [ ] T080 [P] Generate visual baselines for every story listed in contracts/ui-primitives-and-patterns.md "Stories that need visual baselines", using `pnpm test:visual:update` on the pinned Linux image. Commit the snapshots.
- [x] T081 [P] Document the `EntitySearchBar` feature (purpose, the util/component split, the logged quick-filter switch) in a short section of `packages/features/CLAUDE.md`. Document the new ui primitive and patterns in `packages/ui/CLAUDE.md`. Repo-relative paths only (Principle IX).
- [x] T082 Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:storybook` and fix anything red.
- [x] T083 Run every step of quickstart.md §4 against `pnpm dev:navigator`. Record any step that could not be exercised in the PR description, and update spec.md, plan.md or contracts/ in the same PR wherever the built behaviour differs (Principle IX).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Phase 1, and blocks every user story.
  - T005 → T006 → (T009, T019, the tests in later phases).
  - T010 → T011, T012.
  - T012 → T013 → T014 → T015.
  - T016 → T022.
  - T020 → T022.
- **US1 (Phase 3)**: needs Phase 2. T031 needs T010. T029 needs T027 and T028. T035 needs T031–T034. T036 needs T029 and T035.
- **US2 (Phase 4)**: needs US1's T035 and T036 (it extends the same hook and input). Its own util and pattern tasks (T037, T038, T040, T041) can start right after Phase 2.
- **US3 (Phase 5)**: needs Phase 2 only. It is independent of US1 and US2 and can run in parallel with them.
- **US4 (Phase 6)**, **US5 (Phase 7)**, **US6 (Phase 9)**: each needs Phase 2 only (the `FilterButton`, `buildQuickFilters` and quick-filter row). They are independent of each other and of US1–US3.
- **US7 (Phase 8)**: needs at least one popover quick filter (US4 or US6) and US5 to verify all tones. T063 is a verification and completion pass.
- **US8 (Phase 10)**: needs Phase 2. It touches the hook after US1 and US4 exist, to apply inclusion to their inputs. T070–T075 and T077 can start right after Phase 2.
- **Polish (Phase 11)**: after the stories in scope are done.

### Story completion order (graph)

```text
Setup ─▶ Foundational ─┬─▶ US1 ─▶ US2
                       ├─▶ US3
                       ├─▶ US4 ─┐
                       ├─▶ US5 ─┼─▶ US7
                       ├─▶ US6 ─┘
                       └─▶ US8 (hook wiring after US1/US4)
                                             ─▶ Polish
```

### Within each story

Tests first (they must fail) → ui primitives/patterns → navigator-data → feature `util/` → hook
→ components → wiring.

---

## Parallel Opportunities

- **Phase 1**: T002–T004 in parallel.
- **Phase 2**: T007/T008, T009, T011, T016–T019 in parallel once T005/T006 exist. The two parallel tracks are ui (T007, T016–T018) and navigator-data (T010–T011).
- **US1**: tests T023–T026 together; then T027, T028, T032 and T033 together; T030 alongside T031.
- **US2**: T037, T038 and T039 together; T040 alongside T041.
- **US3**: T045–T048 together; T049 alongside T051.
- **Across stories**, after Phase 2 and with enough people: one person takes US1 → US2, another US3, another US4 + US7, another US5 + US6, and US8's preferences tasks (T070–T075, T077) go to anyone.

### Example: launching US1's tests together

```text
T023  ND/src/hooks/collection/use-search-param-suggestions.test.tsx
T024  SB/util/classify-search-input.test.ts + SB/util/select-param-chips.test.ts
T025  SB/util/build-suggestion-models.test.ts
T026  UI/patterns/search-suggestions-popover/search-suggestions-popover.test.tsx
```

### Example: the US4 / US5 / US6 quick filters in parallel after Phase 2

```text
US4: T054, T055 → T056, T057 → T058
US5: T059 → T060 → T061
US6: T064, T065, T066 → T067 → T068, T069
```

---

## Implementation Strategy

### MVP first (P1 = US1 + US2 + US3)

1. Phase 1 + Phase 2. The bar is mounted and empty.
2. US3 (chips), which is quickest to show value and validates the filter-state wiring.
3. US1 (All-mode popover with counts), the core of the feature.
4. US2 (selector and Enter-to-apply).
5. **Stop and validate**: quickstart §4 steps 1–4. Demo or merge as the MVP increment.

### Incremental delivery

1. P2: US4, then US5, then US7 (the quick-filter row with dates and booleans, plus the active state) → quickstart §4 step 5.
2. P3: US6 (number and allowed values), then US8 (configuration) → quickstart §4 step 7.
3. Polish → full quickstart run.

### Notes

- Each story keeps the app shippable: an empty row collapses, so a partially built bar never
  shows empty chrome.
- If an implementation detail turns out to differ from a contract, amend that contract in the
  same PR (Principle IX).

---

## Open after `/speckit-implement` (2026-10-07)

- **T080** — visual baselines are generated in the pinned `mcr.microsoft.com/playwright:v1.61.1-noble`
  container by the CI re-baseline workflow (`.github/workflows/ci.yml`), which commits them;
  images generated on a developer machine would not match. Run that workflow for the new and
  changed stories after pushing.
- **T083** — run in the browser on 2026-10-07 against a real ContentGrid app (read-only:
  searching and filtering only). Checked and working: "All" mode popover with parameter chips and
  counts ("?" for unsearched, 0 for no results), client-filtered allowed values, picking a
  suggestion (chip + list narrows 45 → 9 + URL + quick filter turns blue), boolean quick filter
  (green, Yes icon, chip), date quick filter "Last year" (one "between" chip, date-only
  `~from`/`~until`), closing a range chip clears both bounds, a number typed in "All" lists
  integer parameters first, "No matches" state, keyboard ArrowDown + Enter selects a parameter
  chip, Enter applies "12" to the integer parameter, number quick filter layout (exact, Min/Max
  side by side), relation grouping in the selector. **Not exercised in the browser**: the
  configuration page's "Searchable attributes" control, the failure / Retry path, narrow
  viewport, and a full keyboard-only pass (all covered by unit and Storybook tests). Cosmetic
  note: the number popover's "Min" / "Max" labels wrap at the default popover width.
