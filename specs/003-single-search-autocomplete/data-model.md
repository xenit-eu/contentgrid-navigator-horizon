# Phase 1 Data Model: Advanced Single Search Bar with Autocomplete

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

No new persisted/server-side data is introduced (per the spec's own Assumptions — this is a new way to query existing data). The entities below are front-end view-model shapes, derived at request time from existing `navigator-data` accessor types (`ProfileEntity`, `SearchHalFormTemplateProperty`, `EntityItem`, `RecordTableSortOption`, `EnumOption`) and never persisted.

## SearchTermSuggestionCandidate (raw, pre-budget)

One matching value from one contributing attribute, before the FR-025/026 budget is applied.

| Field               | Type                  | Notes                                                                                                                                      |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `attributeGroupKey` | `string`              | The `SearchHalFormTemplateProperty.groupKey` this candidate belongs to — used to bucket candidates per attribute for budget division (D5). |
| `attributeLabel`    | `string`              | Display label for the source attribute (`profileAttribute?.title` / relation title, formatted per existing `formatFieldName` fallback).    |
| `relationLabel`     | `string \| undefined` | Present only when the source property `isOverRelation` — the relation's display name (FR-004).                                             |
| `propertyName`      | `string`              | The raw HAL-FORMS search property name (e.g. `"code~prefix"`, `"company.name~prefix"`) — what gets set as the filter key on selection.     |
| `value`             | `string`              | The raw suggested value, exactly as returned by the per-attribute typeahead query.                                                         |

## SearchTermSuggestion (post-budget)

Same shape as `SearchTermSuggestionCandidate`, after `applySuggestionBudget` (research D5) has deduplicated within each `attributeGroupKey` and applied the 20-total/even-division/redistribution rule. This is what the UI actually renders and what FR-010 applies as a filter (`filters[propertyName] = value`) when selected.

## EffectiveMatchSuggestion (post-selection)

| Field                      | Type                  | Notes                                                                                                                                                                                                                                    |
| -------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item`                     | `EntityItem`          | The matching record — same entity type as the collection being searched (FR-024), already ABAC-filtered by the underlying collection query (FR-017). Rendered using the record's existing summary display, same as elsewhere in the app. |
| `matchedViaAttributeLabel` | `string \| undefined` | Optional, informational only — which attribute the match came through; not required by any FR but cheap to carry since the per-attribute fan-out already knows it.                                                                       |

Produced by `selectEffectiveMatches` (research D5): merges every attribute's raw record candidates, dedupes by `item.id` (a record can match on more than one attribute), orders by the collection's current/default sort (FR-028), truncates to 5 (FR-007).

## AllowedValueSuggestion

Reuses the existing `EnumOption` type (`{ value: string; label: string }`) unchanged — no new type. Produced by `filterEnumOptions` (research D8) from a `HalFormsField`'s already-resolved `options`.

## SortShortcut

Reuses the existing `RecordTableSortOption` type unchanged — no new type. Sourced the same way `entity-item-collection-table.tsx`'s `toRecordTableSortOptions` already does, from `profile.searchTemplate.sortOptions`.

## DateRangeShortcut

| Field               | Type                                                     | Notes                                                                                              |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `attributeGroupKey` | `string`                                                 | Which date/datetime attribute this shortcut targets (independent per FR-023).                      |
| `preset`            | `"last-day" \| "last-week" \| "last-month" \| undefined` | Set when a relative preset is chosen (FR-021); `undefined` when an explicit range is used instead. |
| `range`             | `{ from: Date; to: Date } \| undefined`                  | Set when an explicit start/end pair is chosen (FR-022); mutually exclusive with `preset`.          |

A preset resolves to a concrete `{ from, to }` pair at apply-time (research D6/D7 — evaluated against local "now"), then is encoded onto the entity's existing `~after`/`~before` (or `~from`/`~until`) search properties via the SAME `handleFilterChange` path manual date entry already uses — no new encoding logic beyond what `coerceFilterValue`/`applyFilterValues` (`packages/features/src/search/filter-properties.ts`) already provide.

## EntitySearchSuggestionsResult (hook return shape — `useEntitySearchSuggestions`)

| Field                      | Type                                       | Notes                                                                                             |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `searchTermSuggestions`    | `readonly SearchTermSuggestionCandidate[]` | Unbudgeted; the view applies `applySuggestionBudget` before rendering.                            |
| `effectiveMatchCandidates` | `readonly EntityItem[]`                    | Unbudgeted, already same-entity-type; the view applies `selectEffectiveMatches` before rendering. |
| `isLoading`                | `boolean`                                  | True while any per-attribute request is in flight (research D6).                                  |
| `isError`                  | `boolean`                                  | True only once every request has settled with zero usable results (research D6).                  |
| `refetch`                  | `() => void`                               | Re-fires every per-attribute request (FR-027's retry).                                            |

## Relationships

```
ProfileEntity.searchTemplate.searchProperties (existing)
  │
  ├─ filtered to prefix-match/full-text ──▶ contributes to SearchTermSuggestionCandidate + (via current-entity search) EffectiveMatchSuggestion candidates
  ├─ filtered to allowed-values (enum) ────▶ AllowedValueSuggestion (client-side only, no fan-out)
  ├─ sortOptions ───────────────────────────▶ SortShortcut
  └─ date/datetime properties ──────────────▶ DateRangeShortcut

useEntitySearchSuggestions(profileEntity, query)
  │
  ├─ applySuggestionBudget ─▶ SearchTermSuggestion[]  (rendered, capped 20)
  └─ selectEffectiveMatches ─▶ EffectiveMatchSuggestion[]  (rendered, capped 5)
```

No state transitions or lifecycle beyond standard TanStack Query loading/success/error — this is a read-only feature.
