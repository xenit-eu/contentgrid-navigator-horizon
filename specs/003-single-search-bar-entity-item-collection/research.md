# Research: Single Search Bar for an Entity Item Collection

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-07

This records what exists in the codebase today, the decisions taken for the plan, and why. The
earlier search-bar work on other branches was deliberately not consulted; everything below is
derived from `main`'s working tree.

---

## R1. What the profile tells us about search parameters

**Findings**

- `profileEntity.searchTemplate` (`packages/navigator-data/src/accessors/entity-profile.ts`)
  returns a `SearchHalFormTemplate` (`packages/navigator-data/src/accessors/extended-forms/search-form.ts`).
  Each entry of `searchProperties` is a `SearchHalFormTemplateProperty`:
  `{ property, profileAttribute?, isOverRelation, profileRelation?, searchType, groupKey }`.
- `searchType` is a `ProfileAttributeSearchType`: `exact-match`, `prefix-match`, `full-text`,
  `greater-than`, `greater-than-or-equal`, `less-than`, `less-than-or-equal`. For a direct
  attribute it comes from the attribute's own `blueprint:search-param` entry; for a relation
  parameter (`customer.name~prefix`) from the name suffix.
- `groupKey` is the property name without its `~suffix` (`total~gte` → `total`,
  `customer.name~prefix` → `customer.name`). It groups the parameters of one attribute.
- Integer vs decimal is **not** on the property (both are `type: "number"`); it is
  `profileAttribute.type` (`long` / `double`).
- Allowed values arrive as inline `property.options`; `profileAttribute.allowedValues` also
  exposes them.
- Relation parameters have `profileAttribute === undefined` (the class has no access to target
  profiles). `useTypeahead` already resolves the target (`resolveTarget` in
  `packages/navigator-data/src/hooks/collection/use-typeahead.ts`): `relation.getTargetProfile(allProfiles)`
  then `target.searchTemplate.getSearchPropertyByName(localName)`.
- Audit roles: `ProfileAttribute.isCreatedDate` / `isModifiedDate`, and on the entity
  `createdAtAttribute` / `modifiedAtAttribute` (from `blueprint:constraint`), as Principle II
  requires.
- `profileEntity.searchTemplate` builds a **new object on every access**. Hooks that key a
  `useMemo` on it recompute every render.

**Decision**: Build one normalised list of _search parameter descriptors_ per entity, in a pure
function in the feature's `util/` layer (Principle VIII), from three inputs: the resolved
`HalFormsField[]` (`resolveHalFormsFields(searchTemplate)`), the `SearchHalFormTemplateProperty`
for each field, and the target `ProfileAttribute` for relation parameters (resolved through a
new exported navigator-data helper extracted from `useTypeahead`'s `resolveTarget`). Every
consumer (the selector, the popover, chips, quick filters) reads only these descriptors. The
search template is memoised once per `profileEntity` at the top of the feature hook.

**Rationale**: Starting from `resolveHalFormsFields` keeps the field set, labels and
redundancy rules (exact dropped when prefix/fts exists, strict bound dropped when inclusive
exists, hidden excluded) identical to the advanced filter dialog, so both surfaces show the same
parameters (FR-033). A descriptor list is cheap to test in isolation.

**Alternatives considered**: Reading `searchTemplate.searchProperties` directly (would
duplicate the hal-forms redundancy rules and drift from the dialog); classifying by parsing
`~suffix` strings in the feature (that is navigator-data's job, already done there).

---

## R2. Search-parameter classification

**Decision**: Each descriptor gets a `valueKind` and a `mode`:

| Source                             | `valueKind`         | `mode`                                  | In selector | In popover                         | Quick filter            |
| ---------------------------------- | ------------------- | --------------------------------------- | ----------- | ---------------------------------- | ----------------------- |
| text, `prefix-match`               | `text`              | `prefix`                                | yes         | suggestions (search)               | —                       |
| text, `full-text`                  | `text`              | `full-text`                             | yes         | suggestions (search)               | —                       |
| text, `exact-match`, no options    | `text`              | `exact`                                 | yes         | chip only, count "?"               | —                       |
| any type with inline options       | `allowed-values`    | `allowed-values`                        | yes         | suggestions (client prefix filter) | allowed-values          |
| `long`, `exact-match`              | `integer`           | `exact`                                 | yes         | chip only (number input)           | number                  |
| `double`, `exact-match`            | `decimal`           | `exact`                                 | yes         | chip only (number input)           | number                  |
| `long`/`double`, range             | `integer`/`decimal` | `gte`/`gt`/`lte`/`lt`                   | no          | —                                  | number                  |
| `date`, any                        | `date`              | `exact`/`after`/`before`/`from`/`until` | no          | —                                  | date                    |
| `datetime`, any                    | `datetime`          | same                                    | no          | —                                  | date (with time)        |
| `checkbox`                         | `boolean`           | `exact`                                 | no          | —                                  | boolean                 |
| audit created-date / modified-date | `date`/`datetime`   | range                                   | no          | —                                  | created / modified date |

Quick filters are built per **attribute** (`groupKey`), not per parameter: a number quick filter
bundles that attribute's exact, lower and upper parameters; a date quick filter bundles its lower
and upper bounds. Quick filters are offered for direct attributes only. Range filters over a
relation stay in the advanced dialog (assumption, recorded in the plan).

**Rationale**: Follows FR-007 (selector covers text, integer, decimal), FR-024 (quick filters per
attribute type) and the handwritten description's grouping.

---

## R3. Suggestions and result counts

**Findings**

- `EntityItemCollection.totalItems` is `{ count, isEstimated }` from `total_items_exact`, else
  `total_items_estimate` (`packages/navigator-data/src/accessors/entity-item-collection.ts`).
- `useTypeahead` fetches one page under `queryKeys.typeaheadSuggestions.byUrl`, debounced 250 ms,
  and extracts distinct attribute values. It handles one parameter at a time, does not expose the
  total, and for relation parameters searches the **target** entity, ignoring the current filters.
- Page size cannot be set through the search template (no `_size` property in any fixture).

**Decision**: Add a multi-parameter hook to navigator-data, `useSearchParamSuggestions`, that
runs one query per requested parameter (`useQueries`), debounced once for the shared input:

- **Direct prefix / full-text parameter**: one request on the _current_ entity with the active
  filters plus `param = input`. Suggestions are the distinct values of that attribute on the
  returned page (max 10); the count is that response's `totalItems`. One request yields both.
- **Relation prefix / full-text parameter**: two requests. Suggestions come from the target
  entity (as `useTypeahead` does today). The count comes from the current entity with the active
  filters plus `relation.attr~prefix = input`. Only the second answers "how many items of _this_
  collection would match".
- **Allowed values**: no request for suggestions; the feature filters the inline options by
  prefix (shared pure function, also used by the allowed-values quick filter, FR-030). Its count
  is "?" in "All" mode; when the parameter is selected, a count request runs like any direct
  parameter.
- **Exact text / integer / decimal**: no request in "All" mode → count `null` → "?" (FR-014).
- Each result exposes `status: "idle" | "loading" | "error" | "success"`, `suggestions`,
  `totalItems` and `refetch` (retry, FR-022).
- Query keys embed the full request URL, so a response for an older input can never land under a
  newer input's key (FR-022 race). `placeholderData` is **not** kept across inputs, so stale
  suggestions are never shown as current.
- `useTypeahead` stays as is for the advanced dialog's autocomplete fields; the shared parts
  (`resolveTarget`, `extractSuggestions`) move into exported helpers both hooks call.

**Rationale**: Counts must mean "items of this collection you would get" (FR-014). For direct
parameters this costs nothing extra. Fan-out is bounded by the number of prefix/fts parameters of
included attributes (configurable, FR-034), debounced, and cached (staleTime 30 s).

**Alternatives considered**: Reusing `useTypeahead` N times (no counts, relation counts would be
of the wrong entity); a server-side aggregated suggest endpoint (does not exist).

**Risk**: An entity with many prefix/fts attributes plus relations fans out many requests per
debounced keystroke. Mitigations: debounce, cache, `retry: 0`, only included attributes, and
"All except relations". If it proves too heavy, a concurrency cap can be added in the hook
without changing its contract.

---

## R4. Filter state, URL and the advanced dialog

**Findings**

- Filters live in the URL as `s.<searchPropertyName>=<string>` (`packages/features/src/search/filter-url-state.ts`),
  owned by the route `apps/navigator/src/routes/_app/$entity/index.tsx` and passed to
  `EntityItemCollectionView` as `filters: Record<string, string>` + `onFiltersChange`.
- The view already converts between URL strings and typed values (`coerceFilterValue`,
  `encodeFilterValue`) and renders the advanced dialog from the same `filters`.

**Decision**: The search bar is fully controlled by the same `filters` / `onFiltersChange` pair
(FR-032, FR-033). No new URL keys. The selector mode and the typed input are transient view
state (not in the URL). Applying a value replaces any existing value of that parameter (one
value per parameter, spec Assumptions). The string ⇄ typed-value helpers move from the view into
`packages/features/src/search/` so the view, dialog and search bar share one copy.

**Rationale**: One source of truth means a filter set anywhere shows up everywhere (FR-004a,
FR-025, SC-007) without synchronisation code.

---

## R5. Active-filter chips

**Decision**

- One chip per active **attribute filter**: parameters of one attribute's range (`~after` +
  `~before`, `~gte` + `~lte`) merge into a single chip ("Created at · between · 1 Jan – 7 Jan").
  Closing it removes all of that attribute's range parameters. Any other parameter is its own
  chip.
- The chip shows attribute label, a mode label + icon (prefix, full text, exact, one of,
  after/before/between, ≥/≤/between, is) and the formatted value (date per locale, boolean with
  the true/false icon, allowed value by its option prompt).
- Chips for filters that cannot be resolved against the current search template (stale URL)
  still render with the raw key and value, so the list state is never hidden (FR-037). They
  reuse the existing invalid-filter detection (`findInvalidFilterKeys`).

**Rationale**: A range is one filter from the user's point of view, and the quick filter shows it
as one active state; two chips for it would contradict the quick-filter button.

---

## R6. UI building blocks: primitives vs. patterns vs. feature

**Findings** (`packages/ui/src`)

- Present and reusable: `Chip` (field + label + remove, neutral/applied tones),
  `CountIndicatorChip` (count, `null` → "?", estimated → "~"), `SelectionChip`, `Popover` (+
  `PopoverAnchor`), `Calendar` (react-day-picker 10, range mode works), `ScrollArea`/`ScrollBar`
  (horizontal supported), `Select` (groups + labels), `Input`, `Button`, `Badge`, `Separator`,
  `Tooltip`, `Skeleton`, `StatusPill`.
- `AutocompleteRenderer` shows the accessible combobox pattern used here
  (`role=combobox` + `aria-activedescendant` + `role=listbox`), flat strings only.
- Unused today: `FilterChips` (takes a UI-local `SearchProperty` and parses `~` suffixes inside
  `packages/ui`), `SearchField` (mock shell), `Chip`, `CountIndicatorChip`.
- Not present: toggle / toggle-group, `cmdk` command, input-group, combobox, spinner. No
  coloured outline variants on `Button`/`Badge`. `--success` tokens exist but are not mapped
  into Tailwind's `@theme`.
- Icons: Phosphor only. Attribute-type icons are a private map inside
  `patterns/attribute-selector/attribute-selector.tsx`. Boolean true/false icons are
  `CheckCircleIcon` / `XCircleIcon` (in `features/.../boolean-attribute-renderer.tsx`).
  Audit icons: created → `CalendarIcon`, modified → `PenIcon`.

**Decision**: three layers, each with one job.

_Primitives_ (`packages/ui/src/primitives/`, no domain, no HAL):

| Primitive            | Change                                                                                                              | Why                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Chip`               | **extend**: optional `mode` (label) and `modeIcon`/`valueIcon` slots, `removeLabel`                                 | Spec: "in each chip the search mode is clearly visible and should have been built by using a primitive".                                                                                                                                                          |
| `CountIndicatorChip` | **extend**: `isLoading` state (skeleton pulse instead of "?"/"0")                                                   | Edge case: counts still loading.                                                                                                                                                                                                                                  |
| `SelectionChip`      | **extend**: optional `icon` and `trailing` slot (for a `CountIndicatorChip`)                                        | Popover parameter chips: type icon + label + count.                                                                                                                                                                                                               |
| `FilterButton`       | **new**                                                                                                             | Quick-filter trigger: icon + label, tones `idle` / `active` (blue outline) / `positive` (green) / `negative` (red), optional inline clear `×` (its own button, not nested inside the trigger), forwards ref so it can be a `PopoverTrigger asChild`. Domain-free. |
| `ScrollArea`         | none (use `ScrollBar orientation="horizontal"`)                                                                     | Chip row and quick-filter row overflow.                                                                                                                                                                                                                           |
| theme                | **extend** `src/styles/preset.css`: map `--success*` into `@theme` (`bg-success`, `border-success`, `text-success`) | Green boolean outline without hex literals. Red uses `destructive`, blue uses `ring`/`primary`, grey uses `border`.                                                                                                                                               |

_Patterns_ (`packages/ui/src/patterns/`, plain props, reusable, storied):

| Pattern                                | Change                                                                                                                                                                                                                    | Reuse beyond this feature                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `FilterChips`                          | **rewrite** to plain props: `chips: { id, field, mode, modeIcon?, value, valueIcon? }[]`, `onRemove(id)`, max two lines then horizontal scroll. Drop `search-property-utils.ts` (suffix parsing does not belong in `ui`). | Any filtered list (relation pickers, dashboards). Currently unused, so no consumer breaks. |
| `GroupedSelect` (`grouped-select.tsx`) | **new**: grouped single-select with an icon + type label per option and a compact trigger. Built on `Select`.                                                                                                             | Attribute/parameter pickers elsewhere.                                                     |
| `SearchSuggestionsPopover`             | **new**: anchors to an input, renders a top row of selectable chips (icon, label, count) and grouped option lists (header with count; loading / empty / error+retry per group); full keyboard model (FR-023).             | Any grouped typeahead.                                                                     |
| `DateRangeFilter`                      | **new**: range `Calendar` left, presets right, Clear / Apply. Props: `value: {from?, to?}`, `presets: {id, label}[]`, `onPreset(id)`, `onApply`, `onClear`. Pure dates; the caller converts to date/datetime.             | Any date range filter.                                                                     |
| `SearchableOptionList`                 | **new**: search input above a single-select option list, client prefix filtering via a shared `filterOptionsByPrefix` (`packages/ui/src/lib/`).                                                                           | Allowed-values pickers; later a searchable `EnumRenderer`.                                 |

_Feature_ (`packages/features/src/entity-search-bar/`): everything that knows about entities,
HAL-FORMS fields, filters and preferences — descriptor building, chip models, quick-filter
models, date presets → bounds, the input classifier, and the orchestration view. The number quick
filter renders its fields **through `HalFormsContainer`** with draft state from
`useHalFormsFieldState` (see R7), so no new number field renderer is introduced.

**Rationale**: `packages/ui/CLAUDE.md`: primitives carry no domain; patterns take plain props;
"if a pattern is only used in one feature, it belongs in the feature" — the five patterns above
are generic (no entity or HAL knowledge) and fill gaps other screens have too (the advanced
dialog, relation pickers), so they go in `ui` with stories and visual baselines (ADR-009). The
search-bar layout itself is used only here and stays in the feature.

**Alternatives considered**: adding `cmdk` for the popover (new dependency subject to
Principle VII review, and its filtering model fights server-driven suggestions — rejected);
putting everything in the feature (loses Storybook visual regression and reuse); keeping
`FilterChips` as is (it parses HAL search-property names inside `ui`, against the
primitive/pattern boundary).

---

## R7. HAL-FORMS rule (ADR-004 amended / Principle III)

**Finding**: "Every HAL-Forms-driven form MUST render through the `hal-forms` feature … MUST NOT
add its own field type, `kind` switch or field-state hook."

**Decision**

- Descriptors are built **from** `resolveHalFormsFields` output; the search bar adds no field
  type and no field-state hook.
- The number quick filter (exact + min/max + Clear/Apply) renders the attribute's own fields with
  `HalFormsContainer` (the layout `generateSearchFormLayout` produces already puts exact first and
  pairs the range bounds on one row, matching the handwritten design), and keeps its draft in
  `useHalFormsFieldState`. Apply writes the draft into `filters`.
- The date, boolean and allowed-values quick filters, the selector and the chip row are **not
  form fields**: they are compact filter controls with different interaction models (calendar
  range with presets; a one-click tri-state; a searchable list). They read the descriptor's
  `valueKind`, which is derived once from the resolved field's `kind`. This is the one place the
  feature branches on field kind; it is logged under Complexity Tracking in the plan with the
  reason and the containment rule (a single exhaustive `classifyQuickFilter` in `util/`).

---

## R8. Attribute inclusion (configuration + user preference)

**Findings**: `EntityDisplayPreferences` (zod, `packages/navigator-data/src/accessors/entity-display-preferences.ts`)
merges heuristic ← backend ← user override with a field-agnostic `deepMerge`
(`packages/features/src/preferences/use-entity-display-preferences.ts`). The backend layer
(`useEntityDisplayDefaults`) is a stub returning `{}`. Visible columns are edited persistently on
the entity configuration page (`packages/features/src/preferences/views/entity-configuration-detail.tsx`,
`AttributeMultiSelect`).

**Decision**

- Add `searchAttributes?: string[]` (attribute names) to the schema. Absent = every searchable
  direct attribute included (FR-035 default). The heuristic layer leaves it `undefined`.
- A new `useSearchAttributeInclusion(profileEntity)` in the preferences feature mirrors
  `useColumnVisibility`. Relation parameters bypass it (FR-036). Filters on excluded attributes
  that arrive via URL/dialog still apply and still show as chips (FR-037).
- The configuration page gets a second `AttributeMultiSelect` "Searchable attributes" next to
  "Visible columns", listing direct attributes that have at least one search parameter (audit
  attributes in the "System attributes" group).
- The backend layer automatically supplies `searchAttributes` once its stub is replaced; no extra
  work in this feature.

**Note on `deepMerge` and arrays**: verify during implementation that an array in a higher layer
replaces, not concatenates, the lower layer's array (it must, since `visibleColumns` already
relies on it); add a test either way.

---

## R9. Interaction details resolved for the plan

- **Popover trigger**: opens at ≥ 1 character in "All"/"All except relations", and in
  prefix/fts/allowed-values parameter mode; never for exact/integer/decimal (FR-011, FR-018).
- **Number detection**: input trimmed; `/^-?\d+$/` → integer and decimal parameters offered;
  `/^-?\d*[.,]\d+$/` → decimal only. Locale comma is accepted and normalised to `.` before
  coercion.
- **Enter**: with a highlighted suggestion → apply it; else in parameter mode → apply typed text
  (validated via `coerceFilterValue`; invalid → inline error under the input, FR-020); else
  nothing.
- **Escape**: closes the popover; a second Escape resets the selector to "All".
- **Backspace on empty input** in parameter mode: resets the selector to "All" (convenience,
  not required by the spec — dropped if review objects).
- **Date presets**: computed when Apply is clicked, local time, inclusive. Last day =
  now − 24 h → now; last week = −7 days; last month = −1 calendar month; last year = −1 calendar
  year. A date-only attribute gets `from`/`until` (inclusive) or `after`/`before` adjusted by one
  day depending on which bounds the template offers; a datetime attribute gets full timestamps.
- **Boolean cycle**: unset → true → false → unset (FR-028), writes the attribute's exact
  parameter.
- **Debounce**: 250 ms, matching `useTypeahead`.

---

## R10. Test fixtures

**Finding**: No JSON fixture has a full-text parameter, a `date`-typed parameter, a decimal
search parameter, or audit-constrained attributes (fixture audit fields sit under an
`audit_metadata` object without constraints). The MSW list handler never returns
`total_items_estimate`.

**Decision**: Add one MSW fixture profile (`search-bar` entity) covering: prefix, full-text,
exact text, allowed values, integer exact + range, decimal exact + range, date range, datetime
range, boolean, created-date / modified-date constraints, and two relations with prefix
parameters. Extend `createListHandler` with an option to return an estimated total, and to answer
per-query totals so counts can be asserted. Contract tests for the new hook use this fixture
(constitution "HAL contract tests").

---

## R11. Repo facts worth knowing

- `docs/adr/` stops at ADR-015. The constitution's Principle VIII cites ADR-018, which does not
  exist in the repo; the plan follows the principle text itself.
- `packages/features/src/index.ts` is empty; features are consumed through subpath exports in
  `packages/features/package.json`. A new feature needs a subpath entry.
- `entity-item-collection` is `stable`; a feature it imports must be `stable` too (Principle III:
  a stable feature must not import a candidate/experimental one — not suspended pre-GA).

---

## As built (implementation notes)

Decisions above that changed during implementation, so this file matches the code (Principle IX):

- **R6, horizontal scrolling**: the existing `ScrollArea` primitive only mounts a vertical
  scrollbar, so the chip row and the quick-filter row use native `overflow-x-auto` with the
  repo's `scrollbar-subtle` utility instead of `ScrollArea` + `ScrollBar`.
- **R6, popover structure**: the axe audit showed that a listbox may only contain options and
  groups, so `SearchSuggestionsPopover` renders the chip row and each group with results as its
  own listbox inside a `region`, with status text (loading, no matches, error + Retry) outside
  them. The popover owns the keyboard model; the caller renders the input through
  `renderAnchor`. Chips are option elements styled as chips, not `SelectionChip` buttons.
- **R7**: confirmed — the number quick filter renders through `HalFormsContainer` with
  `generateSearchFormLayout` (exact on its own row, Min / Max paired) and `useHalFormsFieldState`.
- **R8**: `deepMerge` already replaces arrays (it only recurses into plain objects), so no fix
  was needed; a test pins it.
- **R9, Enter**: in parameter mode the typed text is validated first — a whole number for an
  integer parameter, any number (decimal comma accepted) for a decimal one, and for allowed
  values an option matched by label or token, or the only option the text narrows to.
- **R9, "All except relations"** is only offered when the entity has relation parameters.
- **Import cycle**: `entity-search-bar` imports `useSearchAttributeInclusion` by file path, not
  through `preferences/index.ts`, because the preferences previews import the collection view,
  which imports the search bar.
