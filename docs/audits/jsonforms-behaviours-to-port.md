# JSONForms-Only Field Behaviours — Port Audit

**Ticket**: ACC-2846 / HZN-0.5.3  
**Date**: 2026-06-04  
**Author**: generated for Nick Van Vynckt  
**Depends on**: HZN-0.5.2 (entity-profile templates inventory — see [sibling doc](entity-profile-templates-inventory.md))  
**Superseded by**: [docs/audits/phase-5d7-workitems.md](phase-5d7-workitems.md) (HZN-5D.7 implementation work items)  
**ADR**: [ADR-004](../adr/ADR-004-drop-jsonforms-halforms-renderer.md) — Drop JSONForms; HAL-Forms → shadcn renderer

---

## Acceptance Criteria

- [x] All JSONForms-only field behaviours documented (JF-1 through JF-16).
- [x] Each behaviour mapped to a required shadcn equivalent **or** confirmed out-of-scope with justification.
- [x] Output explicitly cross-referenced with HZN-5D.7 work items (see §8).

---

## 1. Scope & Method

### What was reviewed

The old navigator's JSONForms layer at `src/components/form/` in the `contentgrid-navigator` repo:

| File                                                 | Role                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/components/form/jsonforms.ts`                   | HAL-Forms → JSON Schema + UISchema translator           |
| `src/components/form/Form.tsx`                       | Renderer registry, Ajv config, top-level form component |
| `src/components/form/renderers/TextField.tsx`        | Fallback text/number/email renderer                     |
| `src/components/form/renderers/FileField.tsx`        | Binary content field renderer                           |
| `src/components/form/renderers/BooleanField.tsx`     | Tri-state boolean (optional booleans)                   |
| `src/components/form/renderers/DateField.tsx`        | Date-only field                                         |
| `src/components/form/renderers/DateTimeField.tsx`    | Date-time field                                         |
| `src/components/form/renderers/OptionsField.tsx`     | Inline enum via `oneOf`                                 |
| `src/components/form/renderers/TypeAheadField.tsx`   | Prefix-search type-ahead                                |
| `src/components/form/renderers/AddRelationField.tsx` | Relation linking (to-one + to-many)                     |
| `src/components/form/search.ts`                      | URL ↔ values codec (no JSONForms deps — not applicable) |

### The decisive cross-reference

The [HZN-0.5.2 production entity-profile dump](entity-profile-templates-inventory.md) audited real HAL-Forms responses from production. Key findings that constrain this audit:

- **Only 6 of 13 `HalFormsPropertyType` values appear in production**: `text`, `number`, `datetime`, `checkbox`, `file`, `url`.
- **No conditional logic** (no `rule`/`condition`/`effect` in any template).
- **No `oneOf`/`anyOf`-requiring shapes** at the HAL-Forms level.
- **No multi-select string enums** in production templates.
- **All inline enum options** come from `options.inline[]`, not from any JSON Schema construct.

Test fixtures confirming this are at `packages/navigator-data/test-fixtures/halforms/`.

**Consequence**: many JSONForms constructs in the old code are latent — they handle types/shapes the translator _could_ produce but production never exercises. This makes the migration substantially lower risk than it might appear from the source code alone.

---

## 2. Old JSONForms Architecture (Brief)

```
HAL-Forms template
      │
      ▼
FlatJsfFormConvertor / RangedJsfFormConvertor   (jsonforms.ts)
  → JSON Schema (type, format, oneOf, required, …)
  → UISchema (VerticalLayout / HorizontalLayout, scope strings)
      │
      ▼
<JsonForms> component                           (Form.tsx)
  Ajv instance: addFormats + custom formats/keywords (isFile, isOverRelation)
  Renderer registry: rankWith priority dispatch → custom renderers
      │
      ▼
Custom renderers: TextField | FileField | BooleanField | DateField |
  DateTimeField | OptionsField | TypeAheadField | AddRelationField
```

Two translator variants exist:

- **`FlatJsfFormConvertor`** — used for create/edit forms; flat field list.
- **`RangedJsfFormConvertor`** — used for search forms; adds range-pair handling (pairs `~from`/`~until`, `~after`/`~before`, `~gt`/`~lt`, `~gte`/`~lte` into `HorizontalLayout` groups).

---

## 3. Behaviour Catalogue (JF-1 through JF-16)

Legend for **Port target** column:

- **renderer-ext** — needs a new shadcn-native renderer/component
- **fd-ext** — FieldDescriptor extension (carry the fact on a typed descriptor, no special rendering machinery)
- **out-of-scope** — JSONForms plumbing with no shadcn analogue; drop without replacement

| ID    | Behaviour                                                                                                       | Source location                                        | Artefact / Data-driven                                                                                                                                            | Port target                         | Notes                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JF-1  | `oneOf[{const, title}]` encodes inline enum options                                                             | `jsonforms.ts:211-214`, `OptionsField.tsx:33-35`       | **Artefact** — source is `options.inline[]` on the HAL-Forms property                                                                                             | **fd-ext**                          | Replace with `FieldDescriptor.options: {value, label}[]`; drop `oneOf`.                                              |
| JF-2  | `type: ["string", "object"]` union for file fields                                                              | `jsonforms.ts:421`, `Form.tsx:171-173`                 | **Artefact** — JSONForms needs a union to accept both string and File object                                                                                      | **fd-ext**                          | Replace with `FieldDescriptor.type === "file"`; no union needed.                                                     |
| JF-3  | Custom Ajv format `"file"` + `isFile` keyword                                                                   | `Form.tsx:249-254`                                     | **Artefact** — only exists because JSONForms runs Ajv on every render cycle                                                                                       | **out-of-scope**                    | File validation lives in the field component; no schema-level format needed.                                         |
| JF-4  | `isOverRelation` non-standard Ajv keyword                                                                       | `jsonforms.ts:216`, `Form.tsx:253`                     | **Artefact** — needed to route the renderer because JSON Schema has no "relation" type                                                                            | **fd-ext**                          | Replace with a boolean flag on `FieldDescriptor` (e.g. `kind: "relation"`); no Ajv.                                  |
| JF-5  | `[halFormsProperty]` Symbol key sideloaded onto the schema node                                                 | `jsonforms.ts:13-17,217`, `AddRelationField.tsx:35-38` | **Artefact** — JSON Schema has nowhere to carry a typed HAL link; Symbol was the only escape hatch                                                                | **fd-ext**                          | Pass `HalFormsProperty` directly as a typed descriptor prop; no symbol smuggling.                                    |
| JF-6  | Dot-notation property names split into nested JSON Schema `properties`                                          | `jsonforms.ts:26-35,96`                                | **Artefact** — JSONForms scopes use `/`-separated JSON Pointer paths                                                                                              | **fd-ext**                          | Keep flat dot-notation names on `FieldDescriptor.name`; React Hook Form handles dot-notation natively.               |
| JF-7  | `multiValue` → `{type: "array", items: …}` wrapping                                                             | `jsonforms.ts:170-184`                                 | **Artefact** — JSONForms needs an array schema to render multi-value fields                                                                                       | **fd-ext**                          | Replace with `FieldDescriptor.multiValue: boolean`.                                                                  |
| JF-8  | `VerticalLayout` / `HorizontalLayout` UISchema elements                                                         | `jsonforms.ts:276,377-392`                             | **Mixed** — `VerticalLayout` is artefact; `HorizontalLayout` for search range-pairs reflects a **real UX grouping requirement** (e.g. "From … Until …")           | **renderer-ext** (range-pairs only) | `VerticalLayout` disappears. The range-pair grouping is the **only genuinely new shadcn renderer extension** needed. |
| JF-9  | UISchema scope ending in `~prefix` used as renderer dispatch signal                                             | `Form.tsx:137`                                         | **Artefact** — JSONForms dispatches on scope strings; there is no first-class "search operator" concept                                                           | **fd-ext**                          | Replace with `FieldDescriptor.searchOperator` (or `.searchType`) enum field.                                         |
| JF-10 | `exact-match` field suppressed by returning `null` from UISchema builder when a `~prefix`/`~fts` sibling exists | `jsonforms.ts:236-242`                                 | **Data-driven suppression**, artefact mechanism — the profile genuinely has both params but the exact-match one should be hidden in favour of the richer operator | **fd-ext**                          | Simply omit the suppressed field from the `FieldDescriptor` list during translation; no null-control needed.         |
| JF-11 | `rankWith` priority renderer-selection system                                                                   | `Form.tsx:134-254`                                     | **Artefact** — JSONForms' renderer registry requires explicit priority ranking to override defaults                                                               | **fd-ext**                          | Dispatch on `FieldDescriptor.kind` directly in a switch/map; no ranking.                                             |
| JF-12 | `withJsonFormsControlProps` HOC injecting `ControlProps`                                                        | `Form.tsx:113`                                         | **Artefact** — JSONForms injects schema/uischema/data/handleChange through a HOC                                                                                  | **out-of-scope**                    | Replace with React Hook Form `Controller` / typed field context. Standard React patterns apply.                      |
| JF-13 | `visible === false` guard in `FileField`                                                                        | `FileField.tsx:14`                                     | **Artefact** — defensive against a HIDE rule that is never emitted by production                                                                                  | **out-of-scope**                    | Visibility is explicit in the new renderer; no JSONForms rule system to guard against.                               |
| JF-14 | `materialRenderers` / `materialCells` fallback bundle                                                           | `Form.tsx:18-20,288`                                   | **Artefact** — JSONForms requires a baseline renderer bundle for any schema type it encounters                                                                    | **out-of-scope**                    | No baseline-bundle concept in shadcn; every field type is an explicit case.                                          |
| JF-15 | `Ajv allErrors: true` + `addFormats`                                                                            | `Form.tsx:247-248`                                     | **Artefact** — only exists to power JSONForms' per-keystroke schema validation                                                                                    | **out-of-scope**                    | Validation moves to field components and submit-time schema (zod/valibot).                                           |
| JF-16 | `JsonFormsCore onChange` diffed via `JSON.stringify` to prevent render loops                                    | `Form.tsx:303-306`                                     | **Artefact** — JSONForms stores derived schema state internally and fires onChange on every render                                                                | **out-of-scope**                    | Not a problem outside JSONForms; React Hook Form / controlled state does not have this issue.                        |

---

## 4. Constructs NOT Present in the Old Code

The following advanced JSONForms / JSON Schema constructs are **absent from the old navigator** and are also **absent from production HAL-Forms responses**. No porting work is needed; they are listed here to rule them out explicitly.

Cross-reference: the [HZN-0.5.2 inventory](entity-profile-templates-inventory.md) confirms none of these appear in the production template dump or the MSW fixtures at `packages/navigator-data/test-fixtures/halforms/`.

| Construct                                                           | Status in old code                                                   | Status in production data | Verdict                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- | ----------------------------------------------- |
| UISchema `rule` / `condition` / `effect` (HIDE/SHOW/DISABLE/ENABLE) | Not used                                                             | Not emitted               | No port needed                                  |
| `Categorization` / `Category` layouts                               | Not used                                                             | Not applicable            | No port needed                                  |
| `anyOf`                                                             | Not used (only `oneOf`, itself an artefact)                          | Not emitted               | No port needed                                  |
| `$ref` / `definitions`                                              | Not used                                                             | Not applicable            | No port needed                                  |
| Custom Ajv keywords beyond `isFile` / `isOverRelation`              | None                                                                 | Not applicable            | No port needed                                  |
| `email` format renderer path                                        | Code path exists but no production template emits `type: email`      | Not used                  | Latent artefact; no port needed                 |
| `date` (non-datetime) range pair                                    | Translator handles it; no production template uses date-range search | Not used                  | Latent artefact; no port needed                 |
| Nested dot-notation with depth > 1                                  | Translator supports it                                               | Not used in production    | Latent artefact; keep flat on `FieldDescriptor` |

**Summary**: The old navigator's custom Ajv validation reduces to standard formats plus the two artefact keywords (`isFile`, `isOverRelation`). There is no bespoke business validation that HAL-Forms constraints (`required`, `regex`, `minLength`/`maxLength`) cannot express.

---

## 5. Port-Decision Summary

Three buckets, in order of implementation priority:

### Bucket A — Shadcn renderer extension (genuinely new component behaviour)

**One item**: **JF-8** — search range-pair field group.

A `RangePairGroup` component that renders two semantically related search inputs side-by-side (e.g. "Amount from … to …"). This is a real UX requirement that reflects the production profile's paired search parameters (`~from`/`~until`, `~gt`/`~lt`, etc.). It is the only new rendering concept the migration introduces.

### Bucket B — FieldDescriptor extensions (data carried on the descriptor, no special machinery)

**Nine items**: JF-1, JF-2, JF-4, JF-5, JF-6, JF-7, JF-9, JF-10, JF-11.

These all reduce to: express a HAL-Forms fact (options list, field kind, relation link, dot-notation name, multi-value flag, search operator, suppression decision) as a typed property on `FieldDescriptor` rather than encoding it into JSON Schema / UISchema. No additional rendering logic is required beyond what the existing field components already provide — the descriptor just needs richer typing.

Indicative `FieldDescriptor` additions:

```ts
type FieldDescriptor = {
  name: string;                          // dot-notation, kept flat (JF-6)
  kind: "text" | "number" | "datetime" | "checkbox" | "file" | "url"
       | "relation" | "enum";            // replaces rankWith + isOverRelation (JF-4, JF-11)
  options?: { value: string; label: string }[];  // replaces oneOf (JF-1)
  multiValue?: boolean;                  // replaces array wrapping (JF-7)
  halFormsProperty?: HalFormsProperty;  // replaces Symbol smuggling (JF-5)
  searchOperator?: "prefix" | "exact" | "fts" | "range-from" | "range-until" | …; // replaces scope string (JF-9)
  // file type: no union needed — kind === "file" is sufficient (JF-2)
  // suppressed fields: simply excluded from the list (JF-10)
};
```

### Bucket C — Out-of-scope / drop (JSONForms plumbing with no shadcn analogue)

**Six items**: JF-3, JF-12, JF-13, JF-14, JF-15, JF-16.

These are pure JSONForms internal mechanics. Dropping them leaves no functional gap because the new renderer does not use Ajv, does not need a baseline bundle, does not have render-loop problems from internal schema state, and makes visibility explicit.

---

## 6. Port-Decision Table (Full)

| ID    | Description (short)                          | Bucket           | HZN-5D.7 disposition                           |
| ----- | -------------------------------------------- | ---------------- | ---------------------------------------------- |
| JF-1  | `oneOf` enum encoding                        | B — fd-ext       | Work item: add `options` to `FieldDescriptor`  |
| JF-2  | File field type union                        | B — fd-ext       | Work item: `kind === "file"` replaces union    |
| JF-3  | Ajv `"file"` format + `isFile`               | C — out-of-scope | Closed: file validation in component           |
| JF-4  | `isOverRelation` Ajv keyword                 | B — fd-ext       | Work item: `kind === "relation"` on descriptor |
| JF-5  | Symbol sideloading of HAL link               | B — fd-ext       | Work item: typed `halFormsProperty` prop       |
| JF-6  | Dot-notation → nested schema split           | B — fd-ext       | Work item: keep flat names on descriptor       |
| JF-7  | `multiValue` → array schema                  | B — fd-ext       | Work item: `multiValue: boolean` on descriptor |
| JF-8  | Range-pair `HorizontalLayout`                | A — renderer-ext | Work item: `RangePairGroup` component          |
| JF-9  | UISchema scope suffix as operator signal     | B — fd-ext       | Work item: `searchOperator` enum on descriptor |
| JF-10 | Null-control exact-match suppression         | B — fd-ext       | Work item: exclude suppressed fields from list |
| JF-11 | `rankWith` renderer dispatch                 | B — fd-ext       | Work item: `kind`-based dispatch switch        |
| JF-12 | `withJsonFormsControlProps` HOC              | C — out-of-scope | Closed: React Hook Form Controller             |
| JF-13 | `visible === false` guard in FileField       | C — out-of-scope | Closed: visibility explicit in new renderer    |
| JF-14 | `materialRenderers`/`materialCells` fallback | C — out-of-scope | Closed: no baseline-bundle concept             |
| JF-15 | Ajv `allErrors` + `addFormats`               | C — out-of-scope | Closed: validation moves to zod/valibot        |
| JF-16 | `JSON.stringify` onChange diff               | C — out-of-scope | Closed: not a problem outside JSONForms        |

---

## 7. Cross-Reference to HZN-5D.7

Each **Bucket B** item (JF-1, JF-2, JF-4, JF-5, JF-6, JF-7, JF-9, JF-10, JF-11) and the single **Bucket A** item (JF-8) become discrete work items tracked in:

> **[docs/audits/phase-5d7-workitems.md](phase-5d7-workitems.md)**

That document lists each item with: description, acceptance criteria, effort estimate, and dependency order. The suggested sequencing is:

1. Define the `FieldDescriptor` type (covers all Bucket B items at once — they are additive fields on a single type).
2. Implement the HAL-Forms → `FieldDescriptor` translator (replaces `FlatJsfFormConvertor` / `RangedJsfFormConvertor`).
3. Implement field components for each `kind` value using shadcn primitives.
4. Implement `RangePairGroup` (JF-8 — the one renderer extension).

All **Bucket C** items are explicitly closed in `phase-5d7-workitems.md` with the justification documented in §3 above.

---

## 8. Conclusion

The JSONForms → shadcn migration is **lower risk than the source-code complexity suggests**. The old translator supports more than production exercises:

- Production uses only 6 field types; the translator handles ~10.
- Production emits no conditional logic; the translator has branching for HIDE/SHOW rules (which it never actually calls).
- The entire Ajv integration (formats, custom keywords, allErrors) exists solely to power JSONForms' per-keystroke validation loop — a concern that disappears with the framework.

The migration reduces to three steps:

1. **Drop the JSONForms plumbing** (Ajv, renderer registry, materialRenderers, UISchema, HOCs). Nothing in production requires any of it.
2. **Carry the same HAL-Forms facts on a typed `FieldDescriptor`** — nine Bucket B items are additive fields on one type definition, not separate components.
3. **Add one new renderer**: `RangePairGroup` for search range-pairs, which is a genuine UX requirement surfaced by the production profile, not a JSONForms artefact.

The decisive evidence is the [HZN-0.5.2 production template inventory](entity-profile-templates-inventory.md): production HAL-Forms is simple, and the complexity in the old code is an accretion of JSONForms workarounds, not a reflection of data complexity.
