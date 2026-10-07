# Implementation Plan: Single Search Bar for an Entity Item Collection

**Branch**: `ACC-3199-spec` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-single-search-bar-entity-item-collection/spec.md`

## Summary

Add a three-row search surface to the entity item collection page: active-filter chips, a
search-parameter selector with a free-text input and a grouped suggestions popover (with
per-parameter result counts), and a row of quick filters (date, audit date, boolean, number,
allowed values). The bar is controlled by the collection's existing `filters` URL state, so it
stays in sync with the advanced filter dialog and the page link. Which attributes take part is
an `EntityDisplayPreferences` field, edited next to "Visible columns".

The work splits into three layers:

1. **`packages/ui`**: domain-free building blocks. Three existing primitives are extended (`Chip`
   with a visible search mode, `CountIndicatorChip` with a loading state, `SelectionChip` with
   icon and count slots). There is one new primitive (`FilterButton`) and five new or rewritten
   patterns (`FilterChips`, `GroupedSelect`, `SearchSuggestionsPopover`, `DateRangeFilter`,
   `SearchableOptionList`).
2. **`packages/navigator-data`**: one multi-parameter hook (`useSearchParamSuggestions`) that
   returns suggestions and collection-level counts, two helpers extracted from `useTypeahead`,
   and one new preference field.
3. **`packages/features`**: a new `entity-search-bar` feature that derives everything from
   `resolveHalFormsFields` through pure `util/` functions, and is mounted inside
   `EntityItemCollectionView`.

See [research.md](research.md) for the decisions and [contracts/](contracts/) for the interfaces.

## Technical Context

**Language/Version**: TypeScript 6, React 19

**Primary Dependencies**:

- TanStack Query 5 (`useQueries`), TanStack Router 1
- Tailwind CSS 4, shadcn/Radix primitives (owned copies in `packages/ui`)
- react-day-picker 10 (range `Calendar`), `@phosphor-icons/react` 2.1.10
- zod 4, zustand 5
- `@contentgrid/hal-forms` (via navigator-data)

No new packages (research R6: `cmdk` was considered and rejected).

**Storage**:

- Filters live in the URL (`s.<param>` keys; unchanged).
- Search-attribute inclusion lives in the persisted preferences store (localStorage), with a
  backend-defaults layer that is still a stub.
- No server-side changes.

**Testing**:

- Vitest 4 + Testing Library (jsdom) for utilities, hooks and components.
- MSW 2.14 contract tests for the new hook.
- Storybook with Playwright for visual, a11y and `WithInteraction` stories (ADR-009).
- Manual run against the dev server (constitution quality gate).

**Target Platform**: Modern evergreen browsers. Must stay usable at phone width (≈ 375 px).

**Project Type**: Web frontend in a pnpm monorepo (`packages/ui`, `packages/navigator-data`,
`packages/features`, `apps/navigator`, `apps/navigator-experimental`).

**Performance Goals**:

- Suggestions and counts within 1 s of a typing pause for 95% of searches (SC-002).
- Allowed-value filtering with no perceptible delay (SC-003), since it runs client-side with no
  debounce.

**Constraints**:

- Requests are debounced at 250 ms and fan out one request per included prefix/full-text
  parameter, plus one extra request per relation parameter. They are cached for 30 s and not
  retried.
- A response for an older input is never shown as current.
- Colour is never the only signal for a state.

**Scale/Scope**:

- About 9 ui components (new or changed), 1 hook and 2 helpers in navigator-data, 1 feature of
  roughly 10 pure utilities and 8 components, a preferences field and its UI, and an integration
  in the collection view.
- Entities with roughly 1–30 searchable parameters.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below)._

| Principle                             | Status                  | How the design complies                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. HAL is the only interaction model  | ✅                      | Every search URL comes from `profileEntity.searchEntityRequest(values).url`. Values are set through `createValues(...).withValue(...)`. No mutations. No URL building.                                                                                                                                                                                                                                                                                   |
| II. Model-first                       | ✅                      | Parameters come from the search template and profile accessors. Audit dates are found through `isCreatedDate`/`isModifiedDate` (constraints), never by name. Integer vs decimal comes from `ProfileAttribute.type`.                                                                                                                                                                                                                                      |
| III. Package boundaries               | ✅ with one logged item | `ui` gets plain-prop, domain-free components (icons passed in). HAL logic stays in navigator-data. Features import Layer 1 only through navigator-data. The new feature is `stable`, as its `stable` importer requires. The hal-forms rule is respected for fields. The number quick filter renders through `HalFormsContainer`/`useHalFormsFieldState`. The one switch on field kind (quick-filter classification) is logged under Complexity Tracking. |
| IV. Three-track delivery              | ✅                      | `x-stability` is declared. Pre-GA, `stable` is allowed and expected for this importer.                                                                                                                                                                                                                                                                                                                                                                   |
| V. Deny-by-default ABAC               | ✅                      | Read-only feature. Suggestions and counts come from searches the server already filters by ABAC (FR-038). No capability is inferred client-side.                                                                                                                                                                                                                                                                                                         |
| VI. Authentication                    | ✅                      | Only the existing authenticated `apiFetch` path is used.                                                                                                                                                                                                                                                                                                                                                                                                 |
| VII. Supply chain                     | ✅                      | No new dependencies. Lockfile untouched.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| VIII. View-owned data, util placement | ✅                      | The app still passes only identifiers. The route is unchanged. `EntitySearchBar` resolves its own data from `profileEntity`. All reshaping lives in `entity-search-bar/util/`. Shared string⇄value helpers move to `search/` so there is one copy. Components consume finished models.                                                                                                                                                                   |
| IX. Spec traceability                 | ✅                      | Each contract item cites the FRs it serves. The quickstart maps tests to FRs. No local-file references.                                                                                                                                                                                                                                                                                                                                                  |
| Error handling                        | ✅                      | Hook errors reject as `Error`. The per-group error state shows a short message and Retry. Any detailed display goes through `toProblemDisplayModel`.                                                                                                                                                                                                                                                                                                     |
| Quality gates                         | ✅ planned              | MSW contract tests for the new hook, stories for every ui change, and a manual browser run (quickstart §4).                                                                                                                                                                                                                                                                                                                                              |

**Result**: PASS. The single deviation is justified below.

## Project Structure

### Documentation (this feature)

```text
specs/003-single-search-bar-entity-item-collection/
├── handwritten.md       # original handwritten description (input)
├── spec.md              # feature specification
├── plan.md              # this file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 view models and rules
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── ui-primitives-and-patterns.md
│   ├── navigator-data.md
│   └── features.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
packages/ui/src/
├── primitives/
│   ├── chip.tsx                         # EXTEND: mode, modeIcon, valueIcon, removeLabel; tokens instead of hex
│   ├── count-indicator-chip.tsx         # EXTEND: isLoading
│   ├── selection-chip.tsx               # EXTEND: icon, trailing
│   └── filter-button.tsx                # NEW (+ .stories.tsx, .test.tsx)
├── patterns/
│   ├── filter-chips/                    # REWRITE: plain props, 2 lines + horizontal scroll; drop search-property-utils.ts
│   ├── grouped-select.tsx               # NEW
│   ├── search-suggestions-popover/      # NEW: popover, keyboard hook, stories (visual + interaction)
│   ├── date-range-filter.tsx            # NEW
│   └── searchable-option-list.tsx       # NEW
├── lib/filter-options.ts                # NEW: filterOptionsByPrefix
├── styles/preset.css                    # EXTEND: map --success* into @theme
└── index.ts                             # barrel exports

packages/navigator-data/
├── src/accessors/entity-display-preferences.ts          # EXTEND: searchAttributes
├── src/hooks/collection/use-typeahead.ts                # REFACTOR: use extracted helpers
├── src/hooks/collection/search-suggestion-helpers.ts    # NEW: resolveRelationSearchTarget, extractAttributeSuggestions
├── src/hooks/collection/use-search-param-suggestions.ts # NEW (+ .test.tsx with MSW)
├── src/query-keys.ts                                    # EXTEND: searchParamSuggestions
├── src/hooks/index.ts, src/index.ts                     # exports
└── test-fixtures/                                       # NEW search-bar profile; list handler estimate/per-query totals

packages/features/
├── package.json                                         # subpath export ./entity-search-bar
└── src/
    ├── entity-search-bar/                               # NEW feature — layout in contracts/features.md §1
    ├── search/filter-field-values.ts                    # NEW (moved from the collection view)
    ├── preferences/use-search-attribute-inclusion.ts    # NEW
    ├── preferences/views/entity-configuration-detail.tsx # EXTEND: "Searchable attributes"
    └── entity-item-collection/entity-item-collection-view.tsx # EXTEND: mount EntitySearchBar; use moved helpers
```

**Structure Decision**: Keep the existing monorepo layout. Each concern goes to the layer that
owns it under `packages/*/CLAUDE.md`:

- Generic visuals → `packages/ui`
- HAL fetching → `packages/navigator-data`
- Entity/filter semantics → `packages/features/src/entity-search-bar`

`apps/*` needs no change: the collection route already owns `filters`/`onFiltersChange`, and
both apps mount the same view.

## Delivery slices (input for /speckit-tasks)

Ordered so that each slice is testable on its own. Slices map to the spec's user stories.

1. **Foundations** (no visible change): `search/filter-field-values.ts` move, the
   `search-bar` fixture, `--success` theme mapping, and the `filterOptionsByPrefix` util.
2. **US3 chips (P1)**: `Chip` extension, `FilterChips` rewrite, `buildActiveFilterChips`,
   `formatFilterValue`, then mount a bar that shows only the chip row.
3. **US1 + US2 main bar (P1)**:
   - ui: `SelectionChip`/`CountIndicatorChip` extensions, `GroupedSelect`,
     `SearchSuggestionsPopover`
   - navigator-data: extracted helpers + `useSearchParamSuggestions`
   - util: descriptors, selector groups, input classification, param chips, suggestion models
   - feature: selector + input
4. **US4 + US5 + US7 quick filters (P2)**: `FilterButton`, `DateRangeFilter`, `buildQuickFilters`,
   `date-presets`, then the date, audit-date and boolean quick filters with active state and clear.
5. **US6 (P3)**: `SearchableOptionList`, then the allowed-values quick filter, then the number
   quick filter through `HalFormsContainer`.
6. **US8 (P3)**: `searchAttributes` preference, `useSearchAttributeInclusion`, `applySearchInclusion`,
   and the configuration-page control.
7. **Polish**: narrow-viewport layout, keyboard pass, visual baselines, and the quickstart §4
   run.

## Assumptions made while planning

- Quick filters cover **direct** attributes only. Range filters reached through a relation stay
  in the advanced dialog. The spec does not ask for relation quick filters, and they would need
  target-profile typing per button.
- A range filter on one attribute shows as **one** chip (both bounds), and removing it clears
  both bounds (research R5).
- Chips follow profile order (the URL does not record when each filter was applied).
- Backspace on an empty input resets a selected parameter to "All". This is a convenience; drop
  it if review objects.
- The "Searchable attributes" control goes on the entity configuration page (persisted), not in
  the session-only "Columns" popover.

## Complexity Tracking

| Deviation                                                                                                                                                                                                                                                                                | Why needed                                                                                                                                                                                                                                                                                                           | Simpler alternative rejected because                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity-search-bar/util/build-quick-filters.ts` branches on the resolved field's kind (via `valueKind`) to choose a quick-filter type (date / boolean / number / allowed values). ADR-004 (amended) says a feature must not add "its own field type, `kind` switch or field-state hook". | Quick filters are not form fields. They are compact, attribute-level filter controls: a calendar range with presets, a one-click tri-state, a searchable list. The `hal-forms` renderers (native date input, radio chips, plain select) have different interaction models. The spec asks for exactly these controls. | **Adding kinds/renderers to `hal-forms`**: that would push a non-form presentation into the form renderer and change the create and advanced-filter forms too. **Rendering every quick filter through `HalFormsContainer`**: possible only for the number filter, which does use it. **Containment**: one exhaustive switch in one pure util, fed only by `resolveHalFormsFields` output. No new field type and no field-state hook. The number popover renders through `HalFormsContainer` + `useHalFormsFieldState`. |

## Post-design Constitution re-check

Re-evaluated after writing data-model.md and contracts/:

- No new dependency.
- No hand-built URL: count and suggestion requests go through `searchEntityRequest`; relation
  targets come from `getTargetProfile`.
- No raw profile JSON parsing.
- `ui` contracts carry no HAL types; icons and labels are passed in.
- The feature is `stable` and imports only `stable` features (`hal-forms`, `search`, `preferences`).
- Each contract section cites its FRs.

**Gate still PASS**, with the one logged deviation above.

**Repo notes for reviewers** (not violations):

- The constitution's Principle VIII cites ADR-018, which is not in `docs/adr/` (it stops at
  ADR-015). This plan follows the principle text.
- `profileEntity.searchTemplate` returns a new object on each access, so this feature memoises
  it. The existing collection view has the same issue; fixing that is out of scope here.
