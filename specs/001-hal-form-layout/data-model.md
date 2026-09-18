# Data Model: Generic HAL-Forms Field Renderer

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All shapes below live in the new `packages/features/src/hal-forms/` feature (`x-stability:
"experimental"`). None of them replace or modify `entity-item-create`'s or `search`'s existing
types (see research.md's parity decision) — this is a parallel, standalone model.

## `HalFormsField` (Spec: "Form field")

Generalizes `entity-item-create`'s `FieldDescriptor` to cover every kind either existing
mechanism needs (FR-023), plus the two new cross-cutting concerns (provenance, external fill).

```ts
interface HalFormsFieldBase {
  readonly name: string; // HAL-FORMS property name, verbatim (may include ~suffix for a search field)
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly property: HalFormsProperty; // raw property, carried through unmodified (mirrors FieldDescriptor's rule)
}
```

Deliberately does NOT carry `provenance` — provenance describes the field's CURRENT value's
origin, which changes at runtime independently of this template-derived shape. It lives in the
stateful `FieldState` below instead, passed to the renderer the same way `value`/`error` already
are, never baked into a value resolved once from a template.

```ts
type HalFormsField =
  | ({ kind: "text" } & HalFormsFieldBase & {
        regex?: RegExp;
        maxLength?: number;
        format?: "email";
      })
  | ({ kind: "number" } & HalFormsFieldBase)
  | ({ kind: "datetime" } & HalFormsFieldBase & { includesTime: boolean })
  | ({ kind: "boolean" } & HalFormsFieldBase)
  | ({ kind: "file" } & HalFormsFieldBase & { multiple: boolean })
  | ({ kind: "enum" } & HalFormsFieldBase & { options: readonly EnumOption[]; multiValue: boolean })
  | ({ kind: "autocomplete" } & HalFormsFieldBase & {
        multiValue: boolean;
        searchContext?: SearchAutocompleteContext; // present only for a search-derived field
      }); // FR-017/US5 — new kind
```

`SearchAutocompleteContext` (`{ profileEntity: ProfileEntity; searchProperty: SearchHalFormTemplateProperty }`)
is static, template-resolved metadata — everything a caller needs to run `useTypeahead`
(`@contentgrid/navigator-data`) for this field, resolved once by `resolveHalFormsFields`'s search
path rather than re-derived by the caller. It is NOT the live suggestion data itself (FR-024): the
render layer never calls `useTypeahead` on its own — the caller does, and hands the results in via
`FieldState.autocomplete` below. `undefined` for a create-form field, which has no search property
to attach.

**Validation rules** (from FR-008/FR-009/FR-010):

- A field's error state is not part of this descriptor — kept in the field-state model below, so
  a value change doesn't require re-deriving the whole field list.

**Relationships**: produced by `resolveHalFormsFields` (below) from either a `CreateHalFormTemplate`
or a `SearchHalFormTemplate` (both already exposed by `@contentgrid/navigator-data` per
Constitution Principle III's re-export allowance).

## `LayoutSchema` (Spec: "Layout schema")

Originated as `entity-item-create`'s existing `LayoutInformation`/`FieldGroup` shape (the "keep
using the existing rows concept" requirement from the spec's own input, generalized to a second
producer) — since extended (2026-09-18, see spec.md's Clarifications and FR-025–FR-027) with a
title, a description, and a collapsible flag on the grouping unit, renamed `FieldSection` to
match:

```ts
interface FieldRow {
  readonly fieldNames: readonly string[]; // 1 or 2 names, FR-003
}

interface FieldSection {
  readonly title?: string; // FR-025 — optional; a section with neither renders no header
  readonly description?: string; // FR-025/FR-026 — only ever shown alongside a title
  readonly isCollapsible?: boolean; // FR-027 — rows collapse/expand together, never per-row
  readonly rows: readonly FieldRow[];
}

interface LayoutSchema {
  readonly sections: readonly FieldSection[];
}
```

**Rendering rules** (FR-025 through FR-027):

- A section with neither `title` nor `description` renders no header at all — identical to a
  bare `FieldGroup` before this extension (no visual change for every layout this feature
  produced before sections existed, all of which are single, untitled sections).
- `description` never renders without `title` also being present or absent alongside it in the
  same way — it is supporting text under a title, not a standalone label (FR-026).
- `isCollapsible: true` wraps the section's rows in a single toggle, defaulting to expanded; the
  header (if any) doubles as the toggle control. `false`/omitted renders the rows with no
  collapse behavior, same as before this flag existed.

**Validation/reconciliation rules** (FR-004 through FR-007, FR-020):

- A field present in `HalFormsField[]` but never named by any row is **not rendered** — omission
  is the model's default, not an opt-out (FR-004). This is the opposite of `entity-item-create`'s
  `resolveCreateFieldDescriptors`, which auto-appends an unreferenced field as its own row — that
  behavior is deliberately NOT carried over here (see the spec's own input: "when fields are left
  out of the layoutschema i don't want to see them in the form").
- A row's reference to a field name absent from the resolved `HalFormsField[]` (stale — the
  template no longer has it) is dropped from that row; an emptied row is dropped entirely (FR-007).
  This is the one piece of `resolveCreateFieldDescriptors`'s existing reconciliation that DOES
  carry over unchanged.
- A field name's first occurrence (row order) wins; every later duplicate reference is ignored (FR-006).
- When `savedLayout` is omitted entirely (no layout has ever been configured for this form), the
  default is one field per row, in template order, inside a single untitled/non-collapsible
  section — every field visible, none omitted (FR-009/US1 spec Assumptions). Omission (the first
  bullet above) only applies to a field absent from an otherwise-present layout schema, never to
  the no-schema-at-all case.
- These rules apply uniformly whether `LayoutSchema` was hand-authored, generated (see below), or
  (later) admin-edited — there is no special case for source.

**State transitions**: none — a `LayoutSchema` is an immutable, external input to one render;
producing a NEW one (hand-edited or regenerated) is how it "changes," never an in-place mutation.

## `resolveHalFormsFields(template, savedLayout?) → { fields, layout }`

Generalizes `resolveCreateFieldDescriptors` to accept either template kind:

```ts
function resolveHalFormsFields(
  template: CreateHalFormTemplate | SearchHalFormTemplate,
  savedLayout?: readonly (readonly string[])[],
): { fields: readonly HalFormsField[]; layout: LayoutSchema };
```

- For a `CreateHalFormTemplate`: maps `userDefinedProperties` exactly as `resolveCreateFieldDescriptors`
  does today (same `kind` mapping), plus the new `autocomplete` kind when a property's
  `blueprint:attribute` constraint (or an explicit opt-in — left to implementation) marks it as
  autocomplete-eligible.
- For a `SearchHalFormTemplate`: maps `searchProperties` (reusing `filter-properties.ts`'s
  wire-type-to-kind mapping and redundancy suppression as a starting point — see research.md),
  producing one `HalFormsField` per surviving search property.
- When `savedLayout` is omitted **and** `template` is a `SearchHalFormTemplate`: calls
  `generateSearchFormLayout` (below) instead of the one-field-per-row default (FR-018).
- Otherwise (created form, or an explicit `savedLayout` given for either form type): reconciles
  `savedLayout` against `fields` per the `LayoutSchema` rules above, or defaults to one field per
  row when no saved layout exists at all.

## `generateSearchFormLayout(searchTemplate, fields) → LayoutSchema`

Pure function (FR-018/019/020, FR-028/029). Takes the already-resolved `fields` (not the raw
template) so it never re-derives which search properties survived redundancy suppression — that
decision is made once, in `resolveHalFormsFields`'s search-property mapping. Groups `fields` by
`groupKey` (looked up per field name against `searchTemplate.searchProperties` — the same
`groupKey` `filter-properties.ts` already computes); for each group with exactly two
direction-labeled members (`After`/`Before` or `From`/`Until` — mirrors `computeDirectionLabel`'s
classification), emits a two-field row pairing them (FR-019); every other field gets its own
single-field row, in `fields` order.

Rows are then bucketed into sections (FR-028): every row whose field is a relation-traversal
property (`SearchHalFormTemplateProperty.isOverRelation`/`profileRelation`, e.g.
`"customer.name~prefix"`) is placed into a section titled for that relation
(`profileRelation.title`), described with that relation's own `profileRelation.description`
(FR-029), and `isCollapsible: true` — one section per distinct relation, in the relation's
first-appearance order among `fields`. Every direct (non-relation) row stays in a single leading
section with no title/description and `isCollapsible` unset — the exact same flat shape this
function always produced, before sections could carry a title. That leading section is omitted
entirely when every field turns out to be relation-scoped (no direct rows to hold).

FR-029's other half lives in `resolveHalFormsFields`'s `searchPropertyHalFormsField`: an
individual relation-traversal field's own `description` comes ONLY from `profileAttribute?.description`
(which never resolves for a relation traversal — the attribute lives on the target entity's
profile, not this one) — it no longer falls back to `profileRelation.description` the way it
briefly did, so the relation's description shows once, on the section, not repeated on every
field beneath it.

## `FieldExternalFill` (Spec: "external automation fill", US3)

Not a stored entity — a capability exposed by the form-state hook:

```ts
interface HalFormsFormStateApi {
  // ...existing per-field value/touched/error state (mirrors useEntityItemCreateFormState)...

  /** FR-011/FR-012: sets a field's value externally UNLESS the user is actively editing it. */
  readonly setExternalValue: (name: string, value: FieldValue, provenance: ReactNode) => void;
}
```

**Validation rule** (FR-012, Edge Cases): `setExternalValue` is a no-op for a field whose
`fieldState[name].isFocused` (or equivalent "currently being edited") flag is true — the state
hook tracks this the same way it already tracks `touched`.

## `FieldValidationError` (Spec: "Validation error") and per-field `FieldState`

```ts
interface FieldValidationError {
  readonly source: "client" | "server";
  readonly message: string;
}

/** One entry of `HalFormsFormStateApi.fieldState`, keyed by field name. */
interface FieldState {
  readonly errors: readonly FieldValidationError[];
  /** FR-013: extensible, caller-supplied content — not a fixed set of states. Absent → the
   *  renderer shows no provenance indicator at all for this field (FR-015). Lives here, not on
   *  `HalFormsField`, because it describes the CURRENT value's origin — see `HalFormsField`'s
   *  own doc comment for why that can't be baked into a value resolved once from a template. */
  readonly provenance?: ReactNode;
}
```

`FieldValidationError` mirrors the existing `FieldError` shape in
`entity-item-create/state/field-error.ts` — same two-source model (FR-008/FR-009), reused rather
than redesigned. FR-010 ("clears once valid") is a state-hook behavior, not a shape concern.

## Key relationships

```
HalFormsTemplate (CreateHalFormTemplate | SearchHalFormTemplate)
        │
        ▼  resolveHalFormsFields(template, savedLayout?)
        │        │
        │        └─ if search + no savedLayout → generateSearchFormLayout(template)
        ▼
{ fields: HalFormsField[], layout: LayoutSchema }
        │
        ▼  HalFormsContainer renders layout.sections[].rows, each row's field names looked up in `fields`
        │
        ▼  HalFormsFieldRenderer dispatches on field.kind, reading value/error/provenance
             from HalFormsFormStateApi
```
