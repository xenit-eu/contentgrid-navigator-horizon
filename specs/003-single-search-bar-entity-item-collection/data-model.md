# Data Model: Single Search Bar for an Entity Item Collection

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No new server data. Everything below is client-side view models, derived from the profile, the
active filters and the user's preferences. Types are written TypeScript-style for precision;
the code is free to name fields differently as long as the contracts hold.

---

## 1. Inputs (existing)

| Input                             | Source                                                            | Notes                                                                          |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `profileEntity`                   | `useProfileEntity` (navigator-data)                               | Memoise `profileEntity.searchTemplate` once per `profileEntity` (research R1). |
| `fields`, `layout`                | `resolveHalFormsFields(searchTemplate)` (hal-forms)               | Same field set as the advanced dialog.                                         |
| `filters: Record<string, string>` | route URL (`s.<param>` keys) via `EntityItemCollectionView` props | Single source of truth for active filters.                                     |
| `searchAttributes?: string[]`     | merged `EntityDisplayPreferences`                                 | Absent → all searchable direct attributes included.                            |
| target profiles                   | `useProfileEntities`                                              | Needed to type relation parameters (integer vs decimal, allowed values).       |

---

## 2. `SearchParamDescriptor`

One per resolved search field. Built by `buildSearchParamDescriptors` (`util/`).

```ts
type SearchValueKind =
  | "text"
  | "integer"
  | "decimal"
  | "date"
  | "datetime"
  | "boolean"
  | "allowed-values";

type SearchMode = "prefix" | "full-text" | "exact" | "allowed-values" | "gt" | "gte" | "lt" | "lte";

interface SearchParamDescriptor {
  name: string; // HAL-FORMS property name, e.g. "customer.name~prefix" — the filters key
  groupKey: string; // attribute key, e.g. "customer.name"; groups an attribute's params
  attributeLabel: string; // attribute title (or target attribute title for relations)
  label: string; // field label from resolveHalFormsFields (prompt-based)
  valueKind: SearchValueKind;
  mode: SearchMode;
  relation?: { name: string; title: string }; // set when isOverRelation
  auditRole?: "created" | "modified"; // from isCreatedDate / isModifiedDate, direct only
  options?: readonly { value: string; label: string }[]; // inline options (allowed-values)
  field: HalFormsField; // the resolved field, for rendering through hal-forms
}
```

**Validation / derivation rules**

- `valueKind` (research R2): inline options → `allowed-values`; `checkbox` → `boolean`;
  `date` → `date`; `datetime`/`datetime-local` → `datetime`; `number` → `integer` when the
  (target) attribute type is `long`, `decimal` when `double`; otherwise `text`.
- `mode` maps 1:1 from `ProfileAttributeSearchType`; `allowed-values` overrides `exact`.
- `auditRole` only from `ProfileAttribute.isCreatedDate` / `isModifiedDate` — never names
  (Principle II).
- Hidden properties and `_sort` never produce a descriptor (already excluded by
  `resolveHalFormsFields` / `searchProperties`).

**Inclusion** (`applySearchInclusion`): drop descriptors whose `relation` is undefined and whose
`groupKey` is not in `searchAttributes` (when `searchAttributes` is defined). Relation
descriptors are never dropped (FR-036).

---

## 3. Selector model

```ts
type SelectorMode =
  | { kind: "all" }
  | { kind: "all-direct" } // "All except relations"
  | { kind: "param"; name: string }; // a SearchParamDescriptor.name

interface SelectorGroup {
  id: string; // "self" or relation name
  label: string; // entity title or relation title
  options: SelectorOption[];
}

interface SelectorOption {
  value: string; // "__all__", "__all_direct__", or the descriptor name
  label: string; // attribute label
  descriptor?: SearchParamDescriptor; // parameter options only
}
// The component derives the type hint ("Starts with", "Full text", "Exact", "One of",
// "Integer", "Decimal") and the icon from the descriptor; util models carry no ReactNode.
```

- Options: descriptors with `valueKind ∈ {text, allowed-values, integer, decimal}` and
  `mode ∈ {prefix, full-text, exact, allowed-values}` (FR-007).
- Groups: own attributes first, then one group per relation in profile order (FR-009).
- **State transitions**: `all` ⇄ `all-direct` ⇄ `param` by user choice; any successful apply →
  `all` (FR-010, FR-019); Escape on a closed popover → `all`.

---

## 4. Input classification

```ts
type InputClass = "empty" | "integer" | "decimal" | "text";
```

`classifySearchInput(raw)`: trimmed; `""` → `empty`; `/^-?\d+$/` → `integer`;
`/^-?\d*[.,]\d+$/` → `decimal`; else `text`.

Used by `selectParamChips`:

| InputClass | Chips offered (in "all"/"all-direct")         | Order                           |
| ---------- | --------------------------------------------- | ------------------------------- |
| `text`     | text + allowed-values params                  | profile order                   |
| `integer`  | integer + decimal, then text + allowed-values | numbers first (FR-013)          |
| `decimal`  | decimal, then text + allowed-values           | numbers first; integer excluded |
| `empty`    | none (popover closed)                         | —                               |

`all-direct` additionally drops descriptors with a `relation` (FR-021).

---

## 5. Suggestions and counts

```ts
type CountState =
  | { status: "unknown" } // no search ran → "?"
  | { status: "loading" }
  | { status: "known"; count: number; isEstimated: boolean }
  | { status: "error" }; // the group model carries `retry`

interface ParamChipModel {
  descriptor: SearchParamDescriptor; // label and icon are derived from it in the component
  count: CountState;
}

interface SuggestionGroupModel {
  name: string; // descriptor name
  label: string; // group header
  count: CountState;
  status: "loading" | "empty" | "error" | "ready";
  items: readonly { id: string; value: string; label: string }[]; // max 10 (FR-015)
  retry?: () => void;
}
```

**Which parameters are searched** (research R3):

| Mode                              | Searched (server)                       | Client-filtered                        | Count                                    |
| --------------------------------- | --------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `all` / `all-direct`              | every included prefix + full-text param | allowed-values params (inline options) | searched → known; others → unknown ("?") |
| `param` prefix / full-text        | that param only                         | —                                      | known                                    |
| `param` allowed-values            | count request only                      | that param's options                   | known                                    |
| `param` exact / integer / decimal | none (no popover)                       | —                                      | —                                        |

**Suggestion value**: the distinct, non-empty string values of the attribute on the returned
page, in response order, deduplicated, max 10. For relation params the values come from the
target entity's page; the count from the current entity's search.

---

## 6. Active-filter chip model

```ts
interface ActiveFilterChipModel {
  id: string; // `range:<groupKey>` for merged ranges, else the param name — unique per chip
  paramNames: readonly string[]; // all filters keys this chip removes
  field: string; // attribute label (with relation title prefix when relevant)
  mode: string; // "prefix", "full text", "is", "one of", "after", "before", "between", "≥", "≤"
  value: string; // formatted value ("1 Jan 2026 – 7 Jan 2026", "Approved", "12.5")
  valueKind?: SearchValueKind; // with searchMode, the component picks the mode icon
  searchMode?: SearchMode;
  booleanValue?: boolean; // the component shows the true/false icon
  isUnresolved: boolean; // key not in the current template (stale URL) — raw key shown
}
```

**Rules** (`buildActiveFilterChips(descriptors, filters)`):

- Range params of the same `groupKey` (`gt|gte` with `lt|lte`) merge into one chip
  (`mode: "between"` when both are set). Other params: one chip each.
- Empty-string values are not active filters.
- Order: the order filters were applied is not tracked in the URL; chips follow descriptor
  (profile) order, unresolved chips last. Deterministic, so the row does not jump on reload.
- Removing a chip → `onFiltersChange(omit(filters, chip.paramNames))`.

---

## 7. Quick-filter model

```ts
type QuickFilterModel =
  | {
      kind: "date";
      groupKey: string;
      label: string;
      includesTime: boolean;
      auditRole?: "created" | "modified";
      lower?: string;
      upper?: string; // param names of the bounds offered
      lowerInclusive: boolean;
      upperInclusive: boolean;
    }
  | {
      kind: "number";
      groupKey: string;
      label: string;
      valueKind: "integer" | "decimal";
      fieldNames: readonly string[];
    } // exact and/or range params, rendered via HalFormsContainer
  | { kind: "boolean"; groupKey: string; label: string; param: string }
  | {
      kind: "allowed-values";
      groupKey: string;
      label: string;
      param: string;
      options: readonly { value: string; label: string }[];
    };

interface QuickFilterState {
  isActive: boolean; // any of its params set in filters (FR-025)
  tone: "idle" | "active" | "positive" | "negative"; // boolean uses positive/negative (FR-028)
}
```

**Rules** (`buildQuickFilters(descriptors)` — one exhaustive switch on `valueKind`):

- Built from direct, included descriptors only, grouped by `groupKey`, in profile order, audit
  date filters (`created`, `modified`) last.
- `date`/`datetime` with at least one bound → `date`; `integer`/`decimal` with at least one
  param → `number`; `boolean` → `boolean`; `allowed-values` → `allowed-values`.
- `isActive` = any of the model's params has a non-empty value in `filters`.
- **Boolean transitions**: unset → `"true"` → `"false"` → unset (removes the key).
- **Clear (×)**: removes every param of the model from `filters` without opening the popover.

---

## 8. Date presets

```ts
type DatePresetId = "last-day" | "last-week" | "last-month" | "last-year";
```

`resolveDatePreset(id, now, model)` → `{ lower?: string; upper?: string }` encoded for the
model's params:

- Range start: now − 24 h / − 7 days / − 1 calendar month / − 1 calendar year, local time.
- Range end: now.
- `includesTime: true` → ISO timestamps. `includesTime: false` → `YYYY-MM-DD`; when only an
  exclusive bound (`after`/`before`) exists, shift by one day so the range stays inclusive.
- Evaluated when Apply is clicked (spec assumption), not when the preset is highlighted.

---

## 9. Preferences (extension)

```ts
// packages/navigator-data — EntityDisplayPreferences (zod)
searchAttributes?: string[];   // attribute names; undefined = all searchable direct attributes
```

- Resolution order: user override → backend default → heuristic (heuristic leaves it
  `undefined`) (FR-035).
- An array in a higher layer replaces a lower layer's array (verify `deepMerge`; research R8).
- Edited on the entity configuration page next to "Visible columns" (FR-035a).
