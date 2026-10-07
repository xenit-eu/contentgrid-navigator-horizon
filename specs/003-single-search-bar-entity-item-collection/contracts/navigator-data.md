# Contract: `@contentgrid/navigator-data` additions

**Layer rules** (`packages/navigator-data/CLAUDE.md`, Principles I–III): all HAL access here;
URLs only from templates/links (`profileEntity.searchEntityRequest(values).url`); values set
through `createValues(template).withValue(...)`; every hook change comes with MSW contract tests.

---

## 1. `resolveRelationSearchTarget` (extracted, exported)

Moved out of `useTypeahead`'s private `resolveTarget`; `useTypeahead` calls it unchanged.

```ts
function resolveRelationSearchTarget(
  searchProperty: SearchHalFormTemplateProperty,
  profiles: readonly ProfileEntity[],
):
  | {
      targetProfile: ProfileEntity;
      targetSearchProperty: SearchHalFormTemplateProperty;
      targetAttribute: ProfileAttribute | undefined;
    }
  | undefined; // undefined when not over a relation or the target cannot be resolved
```

## 2. `extractAttributeSuggestions` (extracted, exported)

Alongside it, `countAttributeValues(collection, attributeName)` (distinct values with their
occurrence counts — what `useTypeahead` returns) lives in the same module,
`src/hooks/collection/search-suggestion-helpers.ts`; only `extractAttributeSuggestions` and
`resolveRelationSearchTarget` are exported from the package.

```ts
function extractAttributeSuggestions(
  collection: EntityItemCollection,
  attributeName: string,
  limit: number,
): string[]; // distinct, non-empty, response order
```

## 3. `useSearchParamSuggestions` (new, `src/hooks/collection/use-search-param-suggestions.ts`)

```ts
interface SearchParamSuggestionRequest {
  searchProperty: SearchHalFormTemplateProperty;
  withSuggestions: boolean; // false → count only (allowed-values in param mode)
}

interface UseSearchParamSuggestionsOptions {
  profileEntity: ProfileEntity;
  requests: readonly SearchParamSuggestionRequest[]; // prefix / full-text / allowed-values params only
  query: string; // raw input; debounced inside (250 ms)
  searchValues: HalFormValues<SearchRequestSpec> | undefined; // active filters (+ sort) of the collection
  minLength?: number; // default 1
  limit?: number; // default 10
}

interface SearchParamSuggestionResult {
  name: string; // searchProperty.property.name
  status: "idle" | "loading" | "error" | "success";
  suggestions: readonly string[];
  totalItems: CollectionTotalCount | undefined; // count of the CURRENT collection with this param applied
  error: Error | null;
  refetch: () => void;
}

function useSearchParamSuggestions(options: UseSearchParamSuggestionsOptions): {
  results: readonly SearchParamSuggestionResult[];
  debouncedQuery: string;
};
```

**Behaviour**

- Below `minLength` (after trim) every result is `idle`; no requests.
- While the debounce is pending (the input changed but its debounced value has not caught up),
  every active result reports `loading` with no suggestions, so an answer for an older input is
  never presented as the answer to a newer one.
- **Count request** (every request): `searchValues.withValue(param, query)` on the current
  entity → `profileEntity.searchEntityRequest(values).url` → fetched as an
  `EntityItemCollection`. `totalItems` is that response's total.
- **Suggestions**:
  - direct param: taken from the same count response (`extractAttributeSuggestions`) — one
    request;
  - relation param: an extra request on the target entity with only
    `targetParam = query` (as `useTypeahead` does) — suggestions from it, count still from the
    current entity.
- Values for number-typed params are coerced (via the codec's type rules); a query that cannot be
  coerced for a param makes that result `idle` without a request.
- Query keys: `queryKeys.searchParamSuggestions.byUrl(profileEntity, url)` (new, under the
  per-entity prefix so existing invalidation covers it). `staleTime` 30 s, `gcTime` 60 s,
  `retry: 0`, no `placeholderData` (stale results never shown under a newer input — FR-022).
- `useQueries` keeps hook order stable regardless of how many requests are passed (Rules of
  Hooks).
- Errors reject with `Error` (constitution "Error Handling"); callers convert with
  `toProblemDisplayModel` when they show detail.

**Contract tests** (MSW, new `search-bar` fixture): direct prefix → one request, values + exact
count; estimated total → `isEstimated: true`; relation param → two requests, count from current
entity; active filters are carried into the count request; error → `status: "error"` and
`refetch` re-requests; query below `minLength` → no request.

## 4. `queryKeys.searchParamSuggestions`

```ts
searchParamSuggestions: {
  byUrl: (profileEntity: ProfileEntity, url: string) =>
    ["EntitySearch", profileEntity.name, url, "suggestions"] as const,
}
```

Nested under `entityItemCollection.forEntity(...)` (the `"EntitySearch"` root), so a
create/update/delete invalidation refreshes the counts; the trailing `"suggestions"` segment keeps
it a separate cache entry from the table's own `entityItemCollection.byUrl` for the same URL, the
same way `infiniteByUrl` stays apart.

## 5. `EntityDisplayPreferences.searchAttributes`

```ts
// entityDisplayPreferencesSchema (zod)
searchAttributes: z.array(z.string()).optional(),
```

- `ProfileEntity.getDefaultPreferences()` does **not** set it (undefined = all).
- Unknown attribute names in a stored value are ignored by the consumer (a renamed attribute must
  not break the bar).

## 6. Test fixtures

- New profile fixture `search-bar` (JSON under `packages/navigator-data/test-fixtures/`) with:
  prefix, full-text, exact text, allowed values, integer exact + `~gte`/`~lte`, decimal exact +
  range, `date` with `~from`/`~until`, `datetime` with `~after`/`~before`, boolean,
  `created-date` and `modified-date` constrained attributes, and two relations with prefix
  params.
- `createListHandler` option to return `total_items_estimate` instead of `total_items_exact`,
  and a resolver form that returns a total per query string.
