# Contracts: Advanced Single Search Bar with Autocomplete

This feature has no externally-exposed HTTP API of its own — it's a frontend read layer over the existing ContentGrid HAL API. The "contracts" that matter are the internal boundaries between `packages/navigator-data` (data), `packages/features` (orchestration), and `packages/ui` (rendering), per this repo's layered architecture (Constitution III, VIII).

## 1. `useEntitySearchSuggestions` (new — `@contentgrid/navigator-data`)

```ts
function useEntitySearchSuggestions(options: {
  profileEntity: ProfileEntity;
  query: string;
  minLength?: number; // default 2
}): {
  searchTermSuggestions: readonly SearchTermSuggestionCandidate[];
  effectiveMatchCandidates: readonly EntityItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};
```

**Contract**:

- Disabled (no requests fired) when `query.length < minLength`, matching `useTypeahead`'s existing convention.
- Internally resolves contributing properties from `profileEntity.searchTemplate.searchProperties` filtered to `prefix-match`/`full-text` operators (the same predicate `resolveHalFormsFields`'s `isStringSearchable` already uses) — the caller never has to enumerate properties itself.
- Fans out one request per contributing property via `useQueries` (never a variable number of separate hook calls — Rules-of-Hooks safety, per `packages/navigator-data/CLAUDE.md`).
- A relation-traversal contributing property still queries the CURRENT entity's own collection for `effectiveMatchCandidates` (research D2) — callers never receive a different entity type in that array.
- Does NOT apply the 20/5 caps, dedup, redistribution, or sort-based selection — that's the caller's job via the pure functions below (D5). This hook returns raw, unbudgeted candidates only.
- Respects existing ABAC filtering automatically (delegates to the same collection-query mechanism every other read already uses) — no special handling needed by callers.

**Callers**: the new `entity-search-bar` feature's view component (only). `useTypeahead` remains unchanged and continues to serve the existing single-field Filters dialog (FR-018) — this hook does not replace or wrap it; both exist independently.

## 2. `applySuggestionBudget` (new — `packages/features/src/entity-search-bar/util/`)

```ts
function applySuggestionBudget(
  candidates: readonly SearchTermSuggestionCandidate[],
  totalCap?: number, // default 20
): readonly SearchTermSuggestion[];
```

**Contract**: pure function, no I/O. Groups `candidates` by `attributeGroupKey`, dedupes `value` within each group, divides `totalCap` evenly across groups with a matching candidate, redistributes any group's unused share to groups with more candidates (FR-025), never exceeds `totalCap` in total (FR-025/026). Order of the input array must not affect which values are chosen for a given cap (deterministic given the same candidate set).

## 3. `selectEffectiveMatches` (new — `packages/features/src/entity-search-bar/util/`)

```ts
function selectEffectiveMatches(
  candidates: readonly EntityItem[],
  currentSortOption: RecordTableSortOption | undefined,
  cap?: number, // default 5
): readonly EffectiveMatchSuggestion[];
```

**Contract**: pure function, no I/O. Dedupes by `item.id`, orders by `currentSortOption` when present (falling back to the collection's server-returned default order when absent — never an ad-hoc relevance score, per FR-028), truncates to `cap`.

## 4. `filterEnumOptions` (new — `packages/features/src/entity-search-bar/util/`)

```ts
function filterEnumOptions(options: readonly EnumOption[], query: string): readonly EnumOption[];
```

**Contract**: pure, synchronous, no I/O — substring match against `label` and `value`. Only ever called with a field's already-resolved inline `options` (never triggers a remote options fetch).

## 5. `decodeSearchTermFromSearchState` / `applySearchTermToSearchState` (new — `packages/features/src/search/`)

```ts
function decodeSearchTermFromSearchState(search: EntitySearchState): string | undefined;
function applySearchTermToSearchState(
  prev: EntitySearchState,
  term: string | undefined,
): EntitySearchState;
```

**Contract**: same shape and guarantees as the existing `decodeSortFromSearchState`/`applySortToSearchState` siblings — a single scalar URL key (`q`), round-trips exactly, leaves every other key untouched, `undefined` removes the key.

## 6. `SearchSuggestionsPopover` (new — `@contentgrid/ui` pattern)

Plain, descriptor-agnostic props only (per `packages/ui/CLAUDE.md`'s primitive/pattern boundary) — no `HalFormsField`, no `SearchHalFormTemplateProperty`, no other HAL-Forms-shaped type crosses this boundary:

```ts
interface SearchSuggestionsPopoverProps {
  query: string;
  onQueryChange: (query: string) => void;
  searchTermSuggestions: readonly {
    propertyName: string;
    value: string;
    attributeLabel: string;
    relationLabel?: string;
  }[];
  effectiveMatches: readonly { id: string; label: string; href?: string }[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectSearchTermSuggestion: (propertyName: string, value: string) => void;
  onSelectEffectiveMatch: (id: string) => void;
  sortOptions?: readonly { value: string; label: string }[];
  currentSort?: string;
  onSortChange?: (value: string | undefined) => void;
  dateShortcuts?: readonly { attributeGroupKey: string; label: string }[];
  onApplyDatePreset?: (
    attributeGroupKey: string,
    preset: "last-day" | "last-week" | "last-month",
  ) => void;
  onApplyDateRange?: (attributeGroupKey: string, from: Date, to: Date) => void;
}
```

**Contract**: purely presentational, built from existing primitives (`Popover`, `Input`) per research D10 — fetches nothing itself, matches the "caller supplies already-resolved data" rule `AutocompleteRenderer` already establishes for this codebase's combobox-style patterns.

## 7. Composition point — `EntityItemCollectionView` (existing, stable — unchanged)

The new feature's view wraps/renders alongside `EntityItemCollectionView` (`packages/features/src/entity-item-collection/`), driving it purely through its EXISTING public props: `filters`, `onFiltersChange`, `currentSort`, `onSortChange` (research D7). No new prop is added to that stable component — the search bar and the existing Filters dialog remain two independent entry points into the same shared state (FR-018).
