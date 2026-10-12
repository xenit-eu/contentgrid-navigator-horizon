# Contract: `@contentgrid/features` additions

**Layer rules** (`packages/features/CLAUDE.md`, Principles III, IV, VIII): no Layer-1 imports
(go through `@contentgrid/navigator-data`); HAL-FORMS fields only through the `hal-forms`
feature; transformation in `util/`, components consume already-transformed models.

---

## 1. New feature `entity-search-bar`

- Directory: `packages/features/src/entity-search-bar/`
- `package.json`: `{ "x-stability": "stable" }` — required because the `stable`
  `entity-item-collection` imports it (Principle III; not affected by the pre-GA exception).
- Subpath export `./entity-search-bar` in `packages/features/package.json`.

### Public API (`index.ts`)

```ts
interface EntitySearchBarProps {
  profileEntity: ProfileEntity;
  filters: Readonly<Record<string, string>>; // the collection's active filters (URL state)
  onFiltersChange: (next: Record<string, string>) => void;
  currentSort?: string; // only so suggestion pages follow the list's sort
  actions?: ReactNode; // the page's own controls, right-aligned on the quick-filter row (FR-031a)
  className?: string;
}

function EntitySearchBar(props: EntitySearchBarProps): JSX.Element | null;
```

- Renders the three rows of FR-001: `FilterChips`, then selector + input + suggestions popover,
  then the quick-filter row.
- Each row collapses when it has nothing to show (no active filters / no selector-eligible
  params / no quick filters). Returns `null` when all three are empty.
- Never mutates anything except through `onFiltersChange`, always passing the complete next map.

### Internal layout (not exported)

```text
entity-search-bar/                        # (the search-bar MSW wrapper is src/test-utils/search-bar-wrapper.tsx)
├── package.json
├── index.ts
├── entity-search-bar.tsx                 # composes the three rows; orchestration only
├── use-entity-search-bar.ts              # the view-model hook (below)
├── test-utils.tsx                        # test harness for controlled quick-filter popovers
├── components/
│   ├── search-param-selector.tsx         # GroupedSelect wrapper (icon-only below `sm`)
│   ├── search-input.tsx                  # input + SearchSuggestionsPopover; Enter submits, other keys forwarded
│   ├── to-suggestion-count.ts            # CountState → the popover's count chip
│   ├── quick-filter-row.tsx              # one-line toolbar, scrolls horizontally
│   ├── date-quick-filter.tsx             # FilterButton + Popover + DateRangeFilter
│   ├── number-quick-filter.tsx           # FilterButton + Popover + HalFormsContainer (+ useHalFormsFieldState)
│   ├── boolean-quick-filter.tsx          # FilterButton cycling unset → true → false
│   ├── allowed-values-quick-filter.tsx   # FilterButton + Popover + SearchableOptionList
│   └── search-icons.tsx                  # icon per valueKind / mode / audit role / boolean value
└── util/
    ├── types.ts                          # SearchParamDescriptor, SelectorMode, CountState, …
    ├── build-search-param-descriptors.ts # data-model §2
    ├── apply-search-inclusion.ts         # data-model §2 (inclusion)
    ├── apply-param-patch.ts              # next complete filters map from a partial patch
    ├── build-selector-groups.ts          # data-model §3 (+ selector value ⇄ mode)
    ├── classify-search-input.ts          # data-model §4
    ├── select-param-chips.ts             # data-model §4
    ├── build-suggestion-models.ts        # data-model §5 (+ which params to request)
    ├── validate-param-value.ts           # Enter in parameter mode (FR-020)
    ├── param-labels.ts                   # parameter display name and type hint
    ├── build-active-filter-chips.ts      # data-model §6
    ├── format-filter-value.ts            # value formatting for chips
    ├── build-quick-filters.ts            # data-model §7 (quick-filter type per valueKind)
    └── date-presets.ts                   # data-model §8 (+ encode / decode of date bounds)
```

Each `util/*.ts` is pure and has a sibling `*.test.ts`. The models in `util/` carry no
`ReactNode`s: components choose icons from `valueKind` / `mode` / `auditRole` / boolean value
(`components/search-icons.tsx`).

### `useEntitySearchBar` (internal view-model)

```ts
function useEntitySearchBar(props: EntitySearchBarProps): {
  searchTemplate: SearchHalFormTemplate | undefined;
  fields: readonly HalFormsField[];
  descriptors: readonly SearchParamDescriptor[]; // every parameter (chips use these)
  setParams: (patch: Record<string, string | undefined>) => void;

  chips: readonly ActiveFilterChipModel[];
  removeChip: (id: string) => void;
  chipTargets: ReadonlyMap<string, ChipTarget>; // clickable chips and where they edit
  editChip: (id: string) => ChipTarget | undefined;

  selectorGroups: readonly SelectorGroupModel[];
  input: {
    value: string;
    setValue: (v: string) => void;
    error: string | undefined; // invalid value for the selected param (FR-020)
    mode: SelectorMode;
    setMode: (m: SelectorMode) => void;
    resetMode: () => void;
    selected: SearchParamDescriptor | undefined;
    popoverOpen: boolean;
    setPopoverOpen: (open: boolean) => void;
    paramChips: readonly ParamChipModel[];
    groups: readonly SuggestionGroupModel[];
    applySuggestion: (paramName: string, value: string) => void;
    selectParam: (name: string) => void; // from a popover chip
    submit: () => void; // Enter with nothing highlighted
  };

  quickFilters: readonly QuickFilterModel[]; // state (isActive, tone, value) included
  applyQuickFilter: (groupKey: string, values: Record<string, string | undefined>) => void;
  clearQuickFilter: (groupKey: string) => void;
  cycleBoolean: (groupKey: string) => void;
  openQuickFilter: string | undefined; // group key of the open quick-filter popover
  setOpenQuickFilter: (groupKey: string | undefined) => void;
  fieldsFor: (groupKey: string) => readonly HalFormsField[]; // memoised per attribute
};
```

- Memoises `profileEntity.searchTemplate` and `resolveHalFormsFields(...)` per `profileEntity`
  (research R1).
- Uses `useSearchParamSuggestions` (navigator-data) for searched params, only while the popover
  is open, and `filterOptionsByPrefix` (ui) for allowed values.
- Uses `useSearchAttributeInclusion` (preferences, imported by file path to avoid an import cycle
  through the preferences previews) for inclusion; selector, suggestions and quick filters use
  the included parameters, chips use all of them (FR-037).
- Every change goes through `setParams(patch)`, which builds the complete next map (removing
  keys whose value is `undefined` or `""`) and calls `onFiltersChange` once; after a main-bar
  apply the input is cleared and the mode reset to `all`.
- "All except relations" is only offered when the entity has relation parameters.
- A "Search" button right of the input does what Enter does with nothing highlighted
  (`input.submit`); it is disabled until a parameter is selected and has a value. Paper-plane
  icon; solid sky (`bg-ring`, white semibold text).
- Clicking an applied-filter chip edits it where it can be set: a single selectable parameter
  (text, allowed values, exact number) is selected in the main bar with its value in the input
  (focused; the filter stays applied until Enter replaces it); otherwise the rendered quick
  filter covering all its parameters opens (range and date chips), scrolled into view. Boolean
  chips (no popover) and chips with neither target are not clickable. The quick-filter popovers
  are controlled by `openQuickFilter` for this; the date draft resets on every opening.

## 2. `search` feature (move, no behaviour change)

Move the view's private string ⇄ typed-value helpers into
`packages/features/src/search/filter-field-values.ts` and export them:

```ts
function filterFieldValues(
  fields: readonly HalFormsField[],
  filters: Record<string, string>,
): FieldValueMap;
function encodeFilterValue(value: FieldValue): string | undefined;
function buildCollectionSearchValues(
  searchTemplate: SearchHalFormTemplate,
  fields: readonly HalFormsField[],
  filters: Record<string, string>,
  currentSort?: string,
): HalFormValues<SearchRequestSpec>; // what the view builds inline today
```

`EntityItemCollectionView` and `EntitySearchBar` both import them (one copy, Principle VIII).

---

## 3. `preferences` feature

```ts
function useSearchAttributeInclusion(profileEntity: ProfileEntity | undefined): {
  includedAttributes: ReadonlySet<string> | "all";
  isIncluded: (attributeName: string) => boolean;
};
```

- Reads `preferences.searchAttributes` from `useEntityDisplayPreferences` (the heuristic layer
  always supplies a list once a profile is known) and returns the set of listed names that are in
  `profileEntity.searchableAttributes`; `[]` → empty set, search off (FR-036a). `"all"` is only
  returned when there is no list at all (no profile yet).
- `entity-configuration-detail.tsx`: add an `AttributeMultiSelect` labelled "Searchable
  attributes" under "Visible columns", options = direct attributes with at least one search
  parameter (audit attributes as system options), `values` from the resolved inclusion,
  `onChange` → `setOverride({ searchAttributes })` (FR-035a).

---

## 4. `entity-item-collection` integration

- `EntityItemCollectionView` renders
  `<EntitySearchBar profileEntity filters onFiltersChange currentSort actions />` as the first row
  of the view, above the table, so it stays usable while the table is loading or shows an error.
- The page title block (heading, entity icon, "N items" subtitle) is removed (FR-001a): the
  search bar is the first row of the view.
- The "Filters" button and dialog stay (FR-033); they read the same `filters`.
- The "Columns" popover and the "Filters" button move from the table's toolbar into the search
  bar's `actions` (right-aligned on the quick-filter row, outside its scrolling area; small button
  size to match the quick filters) (FR-031a). Without `onFiltersChange` (no search bar) they stay
  in the table's toolbar.
- No route changes: the URL contract (`s.<param>`, `sort`) is unchanged.
