# Phase 0 Research: Advanced Single Search Bar with Autocomplete

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-23

This document resolves the open technical unknowns behind the spec's functional requirements. Each decision cites the concrete file/mechanism it's grounded in — no speculative APIs.

---

## D1: Can one server request satisfy "term matches via ANY of N attributes"?

**Decision**: No. There is no OR-across-attributes search capability anywhere in the stack today. The feature must fan out one request per contributing attribute and merge/cap/dedupe client-side.

**Rationale**: Every `SearchHalFormTemplateProperty` maps to exactly one attribute (direct or relation-traversal); `.withValue(name, value)` sets one named query param per property, and the codec (`@contentgrid/hal-forms`'s `urlencodedQuerystring()`) turns each set value into its own query param — standard AND-composed REST filtering. `useTypeahead` itself is hard-scoped to exactly one `searchProperty` per call, firing exactly one `useQuery`/request (`packages/navigator-data/src/hooks/collection/use-typeahead.ts`). No `q=`/`_search=`-style generic parameter exists in the search template model, the root `CLAUDE.md`'s documented search example, or anywhere in `docs/adr/`.

**Alternatives considered**: Waiting on/requesting a backend OR-search capability — rejected for this plan; it's a platform-level change outside this feature's control and would block delivery indefinitely. Flagged as a follow-up platform ask, not a blocker here.

**Consequence for design**: A new orchestration hook is needed (see D5) that fans out per-attribute queries via `useQueries` (the same pattern `useProfileEntities` already establishes for "one query per item in a list"), then merges results in a pure, independently-testable post-processing step.

---

## D2: Which contributing attribute produces which suggestion, and does relation-traversal change the request target?

**Decision**: No special-casing needed for effective matches. A relation-traversal search property (e.g. `company.name~prefix`, `isOverRelation: true`) is still a query parameter on the CURRENT entity's own collection endpoint (`GET /contacts?company.name~prefix=Acme`) — it filters contacts by their company's name, it does not query the companies collection. So effective-match records (FR-024, always same entity type as the collection being searched) fall out of the existing single-entity `searchEntityRequest` mechanism for free, for both direct and relation-traversal attributes.

Search-TERM (value) suggestions are different: to suggest _what value to type_ for a relation-traversal attribute (e.g. which company names exist), `useTypeahead` already queries the _related_ entity's own collection internally (`use-typeahead.ts`'s `resolveTarget`, using `searchProperty.profileRelation.getTargetProfile()`) — this existing behavior is reused unmodified per contributing attribute.

**Rationale**: Confirmed by reading `SearchHalFormTemplateProperty`'s `enhanceSearchProperty` (`search-form.ts`) and `useTypeahead`'s own doc comments, which already document this exact distinction.

**Alternatives considered**: A parallel "fetch matching related records directly" path for effective matches — rejected as unnecessary; the existing relation-traversal search parameter already returns current-entity records filtered by the related value, satisfying FR-024 without extra plumbing.

---

## D3: Where does this feature live (package/track), given the Three-Track constitution gate?

**Decision**: A new feature directory `packages/features/src/entity-search-bar/` with `"x-stability": "experimental"`, wired only into `apps/navigator-experimental`.

**Rationale**: Every existing feature directory this work would naturally touch — `entity-item-collection`, `search`, `hal-forms` — is already `"x-stability": "stable"` (confirmed via each directory's `package.json`). Per Constitution Principle IV, a new feature MUST start at `experimental`, and a feature's stability applies to its whole directory (no fork drift) — so this large new capability cannot be added directly inside an already-stable directory without either wrongly demoting it or mixing stability tiers in one place. `apps/navigator` only imports `stable` features (`apps/navigator/CLAUDE.md`); `apps/navigator-experimental` imports all three tiers and is exactly the "proving ground before promotion" this belongs in (`apps/navigator-experimental/CLAUDE.md`).

**Alternatives considered**: Adding directly to `entity-item-collection` — rejected (stability-mixing, no promotion path for just this sub-piece). Landing in `apps/navigator` first — rejected (violates the generic track's stable-only rule).

**Consequence**: The new `experimental` feature MAY import the existing `stable` `entity-item-collection`/`search`/`hal-forms` features (stable → experimental import is not restricted; only the reverse is), so it composes with — rather than duplicates — `EntityItemCollectionView`'s existing filters/sort plumbing.

---

## D4: New navigator-data capability — shape and naming

**Decision**: One new hook, `useEntitySearchSuggestions`, in `packages/navigator-data/src/hooks/collection/` (collection-resource subfolder, per the existing layout convention), re-exported from the package barrel.

Signature (accessor-based, generic — per the "hooks accept an accessor instance" convention):

```ts
useEntitySearchSuggestions(options: {
  profileEntity: ProfileEntity;
  query: string;
  minLength?: number; // default 2, matching useTypeahead's convention
}): {
  searchTermSuggestions: readonly SearchTermSuggestionCandidate[]; // unbudgeted, per-attribute raw matches
  effectiveMatchCandidates: readonly EntityItem[]; // unbudgeted, per-attribute raw matches, already same-entity-type (D2)
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

**Rationale**: Mirrors `useProfileEntities`'s established "fan out with `useQueries`, combine with `combine`" pattern for "one query per item in a dynamically-sized list" (`packages/navigator-data/CLAUDE.md`'s Rules-of-Hooks section) — the list here is "every contributing `SearchHalFormTemplateProperty`" instead of "every `cg:entity` link." Internally it: (a) resolves the entity's contributing properties from `profileEntity.searchTemplate.searchProperties` (filtered to `prefix-match`/`full-text` operators, matching `resolveHalFormsFields`'s existing `isStringSearchable` check), (b) for each, fires one `searchEntityRequest`-based collection query (capped to a small page size for the effective-match candidate pool) AND reuses the same per-attribute value-suggestion mechanism `useTypeahead` already implements, (c) leaves ALL budget/cap/dedup/ordering logic (FR-007/008/024-028) to a separate, pure, unit-testable function — not baked into the hook itself.

**Alternatives considered**: Extending `useTypeahead` to accept an array of `searchProperty`s — rejected; `useTypeahead` is explicitly single-property by design (it's still needed standalone for the existing multi-field Filters dialog per FR-018), and overloading it risks breaking that established, tested contract. A new hook keeps both use cases independently simple.

---

## D5: Suggestion budget & effective-match selection — where the pure logic lives

**Decision**: Two pure functions in the new feature's own `util/` layer (per Constitution Principle VIII — transformation logic lives in a feature's `util/`, never inline in a view):

- `applySuggestionBudget(candidatesByAttribute, totalCap=20)` → implements FR-025/026 (even division, redistribution of unused share, per-attribute dedup) — pure `Record<attributeKey, string[]> → SearchTermSuggestion[]`, no network/React dependency, directly unit-testable against the redistribution edge cases already called out in the spec's Edge Cases.
- `selectEffectiveMatches(candidatesByAttribute, currentSortOption, cap=5)` → implements FR-007/008/024/028 — merges per-attribute record candidates, dedupes by item id, orders by the collection's current/default sort, truncates to 5.

**Rationale**: Keeps the hard-to-get-right budget/ordering math out of the data-fetching hook and out of the view, so it can be tested with plain fixtures (no MSW, no React Testing Library) — consistent with how `filter-properties.ts`'s pure helpers are already tested today.

---

## D6: Partial-failure semantics (not specified in the spec — implementation default)

**Decision**: The combined suggestion state is: `isLoading` while ANY per-attribute request is still in flight; `isError` only once every request has settled AND zero usable results came back from any of them; otherwise, show whatever matches did come back (a partial failure among several attributes still surfaces the attributes that succeeded).

**Rationale**: FR-027 requires a distinct error state "when the suggestion request itself fails" — read as "the user gets nothing useful back," not "any single one of several parallel requests failed." Silently hiding a partial failure would contradict FR-014's anti-staleness intent less than surfacing a scary error state on every transient blip from one of potentially many attributes would. This is an implementation default, not a new user-facing requirement — flagged here for `/speckit-tasks` to carry into test design.

---

## D7: Sort & date-range shortcuts (FR-020–023) — no new backend or data-layer capability

**Decision**: Both reuse existing, unmodified capability:

- Sort: `profile.searchTemplate.sortOptions` → `RecordTableSortOption[]` (already computed today by `entity-item-collection-table.tsx`'s `toRecordTableSortOptions`) and the existing `onSortChange` callback `EntityItemCollectionView` already exposes.
- Date range: the existing `~after`/`~before`/`~from`/`~until` HAL search properties already modeled by `SearchHalFormTemplateProperty`/`resolveHalFormsFields`, and the existing `filters`/`onFiltersChange` plumbing — a relative preset (FR-021) is purely a client-side convenience that computes a `Date` and calls the SAME `handleFilterChange` path a manual date entry already uses.

**Rationale**: Confirmed no `_size`-style or relevance-search gap exists here — date/sort filtering is already fully general per-attribute, unlike free-text search (D1). This means the new feature composes with `EntityItemCollectionView` via its EXISTING public props (`filters`, `onFiltersChange`, `currentSort`, `onSortChange`) rather than needing any new prop surface on that stable component.

---

## D8: Enum quick-filter (FR-019 / User Story 4) — client-side only

**Decision**: A pure function, `filterEnumOptions(options: readonly EnumOption[], query: string): readonly EnumOption[]`, substring-matching against each option's `label`/`value`. No network call, no new navigator-data capability — `HalFormsField`'s `kind: "enum"` variant already carries fully-resolved `options` (`resolve-hal-forms-fields.ts`).

**Rationale**: Matches the spec's own Assumption that this only applies when a field's allowed values are already inline (not remote/paginated) — confirmed `HalFormsPropertyInlineOptions` already carries the full list synchronously.

---

## D9: URL state for the raw search term

**Decision**: A new `q` key in the existing flat `EntitySearchState` bag (`packages/features/src/search/entity-search-state.ts`), with new codec functions `decodeSearchTermFromSearchState`/`applySearchTermToSearchState` added alongside the existing `filter-url-state.ts`/`sort-url-state.ts` siblings in the already-`stable` `search` feature.

**Rationale**: This satisfies User Story 3 (FR-016) using the exact same pattern `sort-url-state.ts` already establishes for a single scalar URL key. Placing the codec (not the UI) in the stable `search` feature is safe: `apps/navigator` (stable-only) gains access to an inert codec function, but never the experimental UI component that would call it — same shape as how both apps already share `filter-url-state.ts` today.

**Alternatives considered**: Putting the codec inside the new experimental feature instead — rejected; it's pure, reusable, and directly parallels two siblings already living in `search`, and per Constitution III, `navigator-data`/features codecs are meant to be composable this way.

---

## D10: New `packages/ui` pattern component

**Decision**: One new presentational pattern, `packages/ui/src/patterns/search-suggestions-popover.tsx`, built from the existing `Popover`/`Input` primitives — the same construction `autocomplete-renderer.tsx` already uses (no `cmdk` or other new listbox dependency; none exists in this repo, and adding one would need Constitution VII supply-chain review this feature doesn't need to trigger). Takes only plain scalar/array props (suggestion groups, effective-match rows, loading/error flags, sort options, date-shortcut config) — no `HalFormsField`, no `SearchHalFormTemplateProperty`, no other HAL-Forms-shaped type, per the primitive/pattern boundary (Constitution III, `packages/ui/CLAUDE.md`).

**Rationale**: Consistent with the existing `AutocompleteRenderer` precedent for combobox-style UI in this codebase, generalized to carry multiple suggestion kinds instead of one flat string list.
