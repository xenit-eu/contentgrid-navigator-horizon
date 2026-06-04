# Phase 5D.7 Work-Item List

**Ticket:** ACC-2847 / HZN-0.5.4 — Convert findings into Phase 5A fixtures and Phase 5D.7 work-item list
**Date:** 2026-06-04
**Depends on:** HZN-0.5.2 (entity-profile-templates-inventory) · HZN-0.5.3 (jsonforms-behaviours-to-port)

---

## Acceptance criteria

| #   | Criterion                                                                                                                                                 | Status                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Fixture set committed to `packages/navigator-data/test-fixtures/halforms/` (round-trip parity inputs for HZN-5A.6), organised per entity for MSW handlers | **DONE** — 15 entity JSON files + `_profile-root.json` + `README.md` |
| 2   | Anonymised dump at `packages/navigator-data/test-fixtures/entity-profiles/`                                                                               | **DONE** — `entity-profiles-dump.json`                               |
| 3   | Phase 5D.7 work-item list with each item confirmed in-scope or re-estimated                                                                               | **THIS DOCUMENT**                                                    |

---

## Fixture deliverable summary

Committed fixtures are in `packages/navigator-data/test-fixtures/halforms/`.

| File                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `_profile-root.json`     | Profile-root HAL resource (`/profile`)          |
| `all-attribute.json`     | Entity with every supported attribute type      |
| `all-required.json`      | Entity where every field is required            |
| `create-allowed.json`    | Entity with a `create-form` template            |
| `customer.json`          | Customer entity profile                         |
| `employee.json`          | Employee entity profile                         |
| `empty.json`             | Entity with no optional fields                  |
| `many-relation.json`     | Entity with to-many relations                   |
| `not-allowed.json`       | Entity where create/update templates are absent |
| `order.json`             | Order entity profile                            |
| `partially-allowed.json` | Entity with partial template availability       |
| `product.json`           | Product entity profile                          |
| `read-allowed.json`      | Entity with read-only template only             |
| `related-item.json`      | Entity with relation back-references            |
| `supplier.json`          | Supplier entity profile                         |
| `update-allowed.json`    | Entity with `default` (update) template only    |

Full anonymised dump (all 15 entities in one file, host rewritten to `api.example.contentgrid.com`):
`packages/navigator-data/test-fixtures/entity-profiles/entity-profiles-dump.json`

**Consumers:**

- **HZN-2.4** — MSW handler stubs load per-entity fixtures from `halforms/`
- **HZN-5A.6** — round-trip parity tests assert `FieldDescriptor` resolution + form value round-trip for all 15 entities
- **HZN-5D.7** — this work-item list; renderer implementations use the same fixtures for integration tests

**Anonymisation note:** all `href` values pointing to the real application host have been rewritten to `api.example.contentgrid.com`. Link relations and structure are otherwise unmodified.

---

## Inputs

| Audit     | File                                                                                         | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HZN-0.5.2 | [`docs/audits/entity-profile-templates-inventory.md`](entity-profile-templates-inventory.md) | Production HAL-Forms shapes: 15 entities, templates `default`/`search`/`create-form`, 6 of 13 `HalFormsPropertyType` observed (`text`, `number`, `datetime`, `checkbox`, `file`, `url`), enum = inline single-select string arrays, relations = `type:url` + `options.link` remote, search operators encoded as name suffix (`~prefix`, `~gt`, `~gte`, `~lt`, `~lte`, `~after`, `~before`). No `readOnly`, `regex`, `minLength`, `maxLength`, `value` or multi-select enum in any template. Item-level update templates (the `default` PUT template on entity-item resources) were **crawled** for 4 representative entities (all-attribute, order, employee, customer); confirmed: **no `readOnly` and no template-level `value`** on any update template either. Edit-form prefill is client-side from the entity-item body's current values. Content attributes have a dual representation: `file`-typed on create-form (multipart), dot-notation `<attr>.filename`/`<attr>.mimetype` `text` fields on the item `default` (json). Relation-mutation templates confirmed: `set-<rel>` = PUT uri-list + maxItems:1; `add-<rel>` = POST uri-list; `clear-<rel>` = DELETE. Fixtures at `packages/navigator-data/test-fixtures/halforms/items/`. |
| HZN-0.5.3 | [`docs/audits/jsonforms-behaviours-to-port.md`](jsonforms-behaviours-to-port.md)             | JSONForms port decision: one genuine renderer extension needed (search range-pair grouping). FieldDescriptor extensions: enum options, file type, `isOverRelation` flag, HAL-property passthrough, flat dot-notation names, `multiValue`, search operator field, exact/prefix suppression, kind-based dispatch. Out of scope: Ajv plumbing, JSONForms HOC/rank/visible-guard, `materialRenderers`. Absent from production: UISchema rules/conditionals, `Categorization`, `anyOf`, `$ref`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Work-item list

### Master table

| ID    | Title                                                                                                                                                     | Verdict           | Estimate     | Source refs                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ | ----------------------------------------------------------------- |
| WI-1  | FieldDescriptor discriminated union                                                                                                                       | IN SCOPE          | S/M (~4–8 h) | 0.5.2 all shapes · 0.5.3 JF-1,2,4,5,6,7,9,11                      |
| WI-2  | HAL-Forms → FieldDescriptor resolver                                                                                                                      | IN SCOPE          | M (~6 h)     | 0.5.3 JF-9,10,11                                                  |
| WI-3  | TextField renderer                                                                                                                                        | IN SCOPE          | S (~2 h)     | 0.5.2 `text`                                                      |
| WI-4  | NumberField renderer                                                                                                                                      | IN SCOPE          | S (~2 h)     | 0.5.2 `number`                                                    |
| WI-5  | DateTimeField renderer                                                                                                                                    | IN SCOPE          | S (~2 h)     | 0.5.2 `datetime`                                                  |
| WI-6  | BooleanField renderer                                                                                                                                     | IN SCOPE          | S (~2 h)     | 0.5.2 `checkbox`                                                  |
| WI-7  | FileField renderer + multipart switching                                                                                                                  | IN SCOPE          | M (~6 h)     | 0.5.2 `file` + contentType finding                                |
| WI-8  | EnumField (single-select, inline options)                                                                                                                 | IN SCOPE          | S (~3 h)     | 0.5.2 `constrained_text` · 0.5.3 JF-1                             |
| WI-9  | RelationField (to-one + to-many, `options.link`) + relation-mutation templates                                                                            | IN SCOPE          | L (~13 h)    | 0.5.2 relations · 0.5.3 JF-5 · item crawl                         |
| WI-10 | SortField (multi-valued object-enum) + sort UX                                                                                                            | IN SCOPE          | S/M (~4 h)   | 0.5.2 `_sort`                                                     |
| WI-11 | Search operator handling + range-pair group renderer                                                                                                      | IN SCOPE          | M (~6 h)     | 0.5.3 JF-8,10                                                     |
| WI-12 | Round-trip parity test suite (HZN-5A.6)                                                                                                                   | IN SCOPE          | M (~6 h)     | all halforms/ fixtures · HZN-2.4                                  |
| WI-13 | oneOf/anyOf schema generation                                                                                                                             | OUT OF SCOPE      | —            | 0.5.3 JF-3                                                        |
| WI-14 | Ajv validation stack                                                                                                                                      | OUT OF SCOPE      | —            | 0.5.3 JF-2,4                                                      |
| WI-15 | JSONForms runtime plumbing                                                                                                                                | OUT OF SCOPE      | —            | 0.5.3 JF-6,7,11                                                   |
| WI-16 | UISchema rules / conditional show-hide / Categorization                                                                                                   | OUT OF SCOPE      | —            | 0.5.3 JF-N/A                                                      |
| WI-17 | Multi-select string enum (inline `maxItems > 1`)                                                                                                          | DEFERRED-RESERVED | —            | 0.5.2 enum shape                                                  |
| WI-18 | Extra `HalFormsPropertyType` renderers (email, date, time, range, radio, hidden)                                                                          | DEFERRED-RESERVED | —            | 0.5.2 unused types                                                |
| WI-19 | Constraint surfacing (regex, minLength, maxLength) + readOnly field-support                                                                               | DEFERRED-RESERVED | —            | 0.5.2 absent; item crawl confirms also absent on update templates |
| WI-20 | Update-form support: PUT `default` template (application/json) + edit-form prefill from entity-item body + content-attribute dot-notation metadata fields | IN SCOPE          | M (~5–6 h)   | item crawl · items/ fixtures                                      |

---

### IN SCOPE — FieldDescriptor core (HZN-5A.1)

#### WI-1 — FieldDescriptor discriminated union

**Artefact:** TypeScript type/interface exported from `packages/navigator-data` (or a new `packages/features` module)

**Kinds:** `text` · `number` · `datetime` · `boolean` · `file` · `enum` · `relation` · `sort` · `filter`

**Shared fields across kinds:** `name` (dot-notation path), `prompt` (display label), `required`, `readOnly`, `type` (raw HAL-Forms property type passthrough), `multiValue`

**Kind-specific fields:**

- `enum` → `options: string[]`
- `relation` → `relationTarget: string` (target profile href), `multiValue` (to-many flag), `valueField` (`/_links/self/href`)
- `filter` → `operator: 'exact' | 'prefix' | 'gt' | 'gte' | 'lt' | 'lte' | 'after' | 'before'`
- `sort` → `allowedValues: string[]`

**Reserved-unused (structure reserved, renderers not required to act on them yet):** `regex`, `minLength`, `maxLength`, `value`

**Justification:** Central contract between the resolver (WI-2) and all renderers (WI-3–11); must be stable before renderer work starts.

**Source:** 0.5.2 all shapes; 0.5.3 JF-1,2,4,5,6,7,9,11

---

#### WI-2 — HAL-Forms → FieldDescriptor resolver

**Artefact:** Pure function `resolveFieldDescriptors(template: HalFormsTemplate): FieldDescriptor[]`

**Key mapping rules:**

- Wraps (does NOT replace) `@contentgrid/hal-forms` `resolveTemplate` — this is a thin projection layer, not a re-parser
- `type: 'url'` + `options.link` → kind `relation`; `maxItems === 1` → `multiValue: false` (to-one); absent `maxItems` → `multiValue: true` (to-many)
- `_sort` property (object-enum with `allowedValues`) → kind `sort`
- Name suffix parsing: `~prefix` → `operator: 'prefix'`; `~gt` / `~gte` / `~lt` / `~lte` → numeric operators; `~after` / `~before` → datetime operators; bare name → `operator: 'exact'`
- `type: 'checkbox'` → kind `boolean`
- `type: 'file'` → kind `file`
- Inline `options` (string array) → kind `enum`
- All other types → kind per `HalFormsPropertyType` mapping (`text`, `number`, `datetime`)

**Justification:** Isolates HAL-Forms parsing complexity from renderers; enables WI-12 fixture-driven tests.

**Source:** 0.5.3 JF-9,10,11

---

### IN SCOPE — shadcn renderers (HZN-5A.x / 5D.7)

#### WI-3 — TextField renderer

**Artefact:** `<TextField>` shadcn component driven by `FieldDescriptor` kind `text`

**Scope:** plain `<input type="text">`; respects `required`, `readOnly`; label from `prompt`

**Justification:** Simplest case; baseline for all other field renderers.

---

#### WI-4 — NumberField renderer

**Artefact:** `<NumberField>` covering `long`, `double`, `int` HAL-Forms property types

**Scope:** `<input type="number">`; integer vs decimal mode from descriptor type; respects `required`, `readOnly`

**Justification:** `number` is the second most common type in production profiles.

---

#### WI-5 — DateTimeField renderer

**Artefact:** `<DateTimeField>` covering `datetime` and `date` HAL-Forms property types

**Scope:** date-picker or datetime-picker from shadcn; ISO-8601 value serialisation; `date` is treated as a datetime without time component

**Justification:** Production profiles use both `datetime` and `date`; a single component with mode switching avoids duplication.

---

#### WI-6 — BooleanField renderer

**Artefact:** `<BooleanField>` for kind `boolean` (HAL-Forms `checkbox`)

**Scope:** shadcn `Checkbox`; tri-state (`true` / `false` / `null`) when field is not required; binary (`true` / `false`) when required

**Justification:** Optional booleans are nullable in the ContentGrid data model.

---

#### WI-7 — FileField renderer + multipart switching

**Artefact:** `<FileField>` for kind `file` + content-type switching logic at form submission

**Scope:**

- Drag-and-drop file input (shadcn `Input type="file"`)
- When a `create-form` template includes at least one `file` property, the form submission must use `multipart/form-data` instead of `application/json`
- Filename surfaced via `Content-Disposition` on read

**Justification:** File fields require a non-trivial change to the form submission path; medium effort due to the content-type switching requirement identified in 0.5.2.

**Source:** 0.5.2 `file` shape; 0.5.2 `contentType` finding

---

#### WI-8 — EnumField (single-select, inline options)

**Artefact:** `<EnumField>` for kind `enum` with inline `options: string[]`

**Scope:** shadcn `Select` (single-select only); `maxItems: 1` always true for current production data; label from `prompt`; respects `required`

**Justification:** Enum is used for constrained text attributes; inline options are a simple array — straightforward to render.

**Source:** 0.5.2 `constrained_text`; 0.5.3 JF-1

---

#### WI-9 — RelationField (to-one + to-many, `options.link` remote) + relation-mutation templates

**Artefact:** `<RelationField>` for kind `relation`

**Scope:**

- **To-one** (`multiValue: false`): popover single-select; searches the `options.link.href` collection; selected value submitted via `set-<rel>` template (PUT `text/uri-list`, single URI)
- **To-many** (`multiValue: true`): multi-add; submitted via `add-<rel>` template (POST `text/uri-list`, one URI per line)
- `valueField` always `/_links/self/href`; display label resolved from entity item embedded title or `self` href fallback
- Inline "create in new tab" affordance (per ContentGrid entity creation convention)
- Relation clearing: `clear-<rel>` template (DELETE, no body)
- **Relation-mutation template conventions confirmed by the live item crawl:** `set-<rel>` = PUT uri-list + `maxItems: 1` (to-one); `add-<rel>` = POST uri-list + no `maxItems` (to-many); `clear-<rel>` = DELETE. This PUT-vs-POST-per-cardinality convention is **not documented** in the public docs; the item crawl (fixtures at `packages/navigator-data/test-fixtures/halforms/items/`) is the authoritative source.

**Estimate revised to:** L (~13 h) — adds relation-mutation submission wiring on top of the popover UX.

**Justification:** Relations are the most structurally complex field type; to-one and to-many differ in UX, template name, and HTTP method; large estimate reflects popover search UX, `text/uri-list` wiring, and mutation template dispatch.

**Source:** 0.5.2 relations; 0.5.3 JF-5; live item crawl

---

#### WI-10 — SortField + sort UX

**Artefact:** `<SortField>` for kind `sort` (multi-valued object-enum from `_sort` property in `search` template)

**Scope:**

- Renders the `_sort` allowed values as a multi-column sort configurator
- Each active sort slot: `attribute` (from `allowedValues`) + `direction` (`asc` / `desc`)
- Submitted as repeated `_sort=attribute,direction` query parameters

**Justification:** `_sort` is structurally different from all other fields (object-enum, multi-valued, query-param submission) and warrants its own component.

**Source:** 0.5.2 `_sort`

---

#### WI-11 — Search operator handling + range-pair group renderer

**Artefact:**

1. Operator-aware search field dispatch in the search form builder (exact/prefix/gt/gte/lt/lte/after/before)
2. `<RangePairGroup>` renderer: a single shadcn renderer extension that groups a `~gt` / `~lt` (or `~gte` / `~lte`, or `~after` / `~before`) pair for the same attribute into a min–max input row
3. Exact/prefix field suppression: `~prefix` fields are not shown when there is also a `~exact` field for the same attribute (or vice versa, per product decision)

**Justification:** Range-pair grouping is the only genuine new renderer required; all other operator handling is dispatch logic in the resolver (WI-2). Suppression prevents duplicate filter fields for the same attribute.

**Source:** 0.5.3 JF-8,10

---

#### WI-12 — Round-trip parity test suite (HZN-5A.6)

**Artefact:** Vitest test suite under `packages/navigator-data/src/__tests__/halforms-parity/`

**Scope:**

- MSW handlers (from HZN-2.4) serve each of the 15 per-entity fixtures from `test-fixtures/halforms/`
- For each entity: assert that `resolveFieldDescriptors` (WI-2) produces the expected `FieldDescriptor[]` shape
- For each entity with a `create-form` or `default` template: assert that the form value round-trip (field value → HAL-Forms submission body → parsed back) is lossless
- Covers all 6 observed property types: `text`, `number`, `datetime`, `checkbox`, `file`, `url`

**Justification:** Fixture-driven contract test that catches regressions in the resolver without needing a running server; directly satisfies the HZN-5A.6 acceptance criterion.

**Source:** all `halforms/` fixtures; HZN-2.4

---

### OUT OF SCOPE

These items represent JSONForms-specific plumbing or capabilities absent from production data. They are **closed** — no build cost carried forward.

#### WI-13 — oneOf/anyOf schema generation

**Verdict:** OUT OF SCOPE

**Justification:** JSONForms required `oneOf`/`anyOf` generation to drive renderer selection. The FieldDescriptor discriminated union (WI-1) replaces this entirely with kind-based dispatch. No consumer of `anyOf` exists in the new architecture.

**Source:** 0.5.3 JF-3

---

#### WI-14 — Ajv validation stack

**Verdict:** OUT OF SCOPE

**Justification:** Custom Ajv formats (`file`), custom keywords (`isFile`, `isOverRelation`), `allErrors` config, and `addFormats` were all required to make JSONForms validate HAL-Forms-aware constraints. Validation now moves to field components (client-side) and the HAL API (server-side). HAL-Forms `required` is surfaced directly by WI-1/WI-2; `regex`/`minLength`/`maxLength` are reserved in the descriptor for future native HTML constraint use.

**Source:** 0.5.3 JF-2,4

---

#### WI-15 — JSONForms runtime plumbing

**Verdict:** OUT OF SCOPE

**Justification:** `withJsonFormsControlProps` HOC, `rankWith` renderer dispatch, `materialRenderers` fallback bundle, `stringify` onChange-loop guard, and `visible: 'HIDE'` guard are all JSONForms-runtime concepts with no shadcn analogue. The new renderer architecture uses direct React component composition and kind-based dispatch from WI-1.

**Source:** 0.5.3 JF-6,7,11

---

#### WI-16 — UISchema rules / conditional show-hide-disable / Categorization layouts

**Verdict:** OUT OF SCOPE

**Justification:** UISchema `rule`/`condition` constructs and `Categorization` layouts do not appear in any committed code path and are not present in production HAL-Forms profiles. If a future profile requires conditionals, this must be re-opened as new work with a fresh audit.

**Source:** 0.5.3 (absent from analysis); 0.5.2 (no conditional shapes observed)

---

### DEFERRED-RESERVED

These items are not exercised by current production data. No build cost now; descriptor/renderer architecture reserves space for them.

#### WI-17 — Multi-select string enum (inline `maxItems > 1`)

**Verdict:** DEFERRED-RESERVED

**Trigger condition:** A production profile emits an inline `options` string array with `maxItems > 1`

**Reserved by:** `FieldDescriptor.multiValue` on kind `enum`; `<EnumField>` (WI-8) can be extended to multi-select mode without changing the descriptor shape

**Source:** 0.5.2 enum shape (only `maxItems: 1` observed in production)

---

#### WI-18 — Extra `HalFormsPropertyType` renderers

**Types deferred:** `email`, `date` (covered by WI-5 datetime mode), `time`, `datetime-local`, `range`, `radio`, `hidden`

**Verdict:** DEFERRED-RESERVED

**Trigger condition:** A production profile emits one of these types

**Note:** `date` specifically is already handled by the `datetime` renderer (WI-5) in date-only mode; the remaining 6 types require new renderers.

**Source:** 0.5.2 unused `HalFormsPropertyType` values

---

#### WI-19 — Constraint surfacing (regex, minLength, maxLength) + readOnly field-support

**Verdict:** DEFERRED-RESERVED

**Trigger condition:** A production template populates `regex`, `minLength`, `maxLength`, or `readOnly` on a property

**Reserved by:** `FieldDescriptor` carries all these fields (WI-1); renderers honour them when non-null. `regex`/`minLength`/`maxLength` map naturally to HTML `<input>` native constraint attributes; `readOnly` maps to disabled/read-only UI.

**Note on `readOnly`:** The live item crawl confirmed that **no production template** (create-form or item `default`) sets `readOnly` on any property. The original navigator's `jsonforms.ts:197` `readOnly: property.readOnly` passthrough is defensive and unused in practice. `FieldDescriptor.readOnly` is reserved and will be honoured if a future template ever sets it, but there is no current implementation cost. Audit fields (`created_by`/`created_date`/`last_modified_by`/`last_modified_date`) live in the entity-item body under `audit_metadata` and are omitted from all templates entirely.

**Source:** 0.5.2 (absent from profile-level dump); item crawl (absent from update templates too); original translator (not handled in practice)

---

#### WI-20 — Update-form support: PUT `default` template (application/json) + edit-form prefill from entity-item body + content-attribute dot-notation metadata fields

**Verdict:** IN SCOPE

**Estimate:** M (~5–6 h)

**Artefact:** Resolver and renderer support for rendering the item-level `default` PUT update form with edit-form prefill and content-attribute dual representation

**Scope:**

- Render the entity-item `default` template (method PUT, `contentType: application/json`) as an edit form
- Prefill the form from the **entity-item body's current attribute values** — there is no `property.value` prefill in the template; the client reads the current values directly from the item body (same approach as the original navigator's `jsonforms.ts:118`, which reads item-body values)
- Content/file attributes appear as dot-notation `<attr>.filename` and `<attr>.mimetype` `text` fields on the item `default` template (vs. a single `file`-typed property on `create-form`). The resolver (WI-2) and FileField renderer (WI-7) must handle both representations of the same content attribute depending on which template is being rendered.
- **`readOnly` is NOT in scope here** — no production update template sets `readOnly` on any property. `readOnly` support is deferred to WI-19.

**Justification:** The item crawl (4 entities: all-attribute, order, employee, customer) confirmed the exact update-template shape. The content attribute dual representation (`file` on create vs. dot-notation `text` fields on update) is the main new complexity. Fixtures are at `packages/navigator-data/test-fixtures/halforms/items/`.

**Source:** live item crawl; `packages/navigator-data/test-fixtures/halforms/items/`; original navigator `src/modules/EntityInstance/components/Metadata/components/MetadataEditEntityInstance.tsx:42`; `src/components/form/jsonforms.ts:118` (item-body value prefill)

---

## Estimate roll-up

### In-scope items only

| Bucket                          | Items                               | Rough total  |
| ------------------------------- | ----------------------------------- | ------------ |
| FieldDescriptor core (HZN-5A.1) | WI-1, WI-2                          | ~10–14 h     |
| Simple field renderers          | WI-3, WI-4, WI-5, WI-6, WI-8, WI-10 | ~15 h        |
| Complex field renderers         | WI-7, WI-9, WI-11                   | ~25 h        |
| Update-form support             | WI-20                               | ~5–6 h       |
| Parity test suite (HZN-5A.6)    | WI-12                               | ~6 h         |
| **Total in scope**              | **13 items**                        | **~61–66 h** |

Size legend: S = ~2–3 h · M = ~5–7 h · L = ~10–13 h

WI-9 revised from L/~12 h to L/~13 h (adds relation-mutation template dispatch). WI-20 revised from S/~3 h to M/~5–6 h (adds content-attribute dual-representation handling; `readOnly` moved to deferred WI-19).

Out-of-scope (WI-13–16) and deferred-reserved (WI-17–19) carry **zero current cost**.

---

## Hand-off

| Work item(s)                                          | Assigned ticket                           | Notes                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WI-1, WI-2                                            | **HZN-5A.1** — FieldDescriptor + resolver | Must land before any renderer work; exported from `packages/navigator-data` or a new `packages/features` module                                                                                                                                                     |
| WI-12                                                 | **HZN-5A.6** — Round-trip parity tests    | Depends on WI-2 + HZN-2.4 MSW handlers; consumes `test-fixtures/halforms/` directly                                                                                                                                                                                 |
| WI-3–WI-11                                            | **HZN-5D.7** — Renderer audit and port    | Each WI maps to one renderer; WI-9 (RelationField) and WI-11 (RangePairGroup) are the most complex; WI-7 (FileField) touches form submission path                                                                                                                   |
| WI-20                                                 | **HZN-5D.7** — Renderer audit and port    | Depends on WI-1 (FieldDescriptor) and WI-2 (resolver handling item `default` template + dot-notation content fields); entity-item fixtures are now committed at `packages/navigator-data/test-fixtures/halforms/items/`; no `readOnly` in scope (deferred to WI-19) |
| MSW handler stubs consuming `test-fixtures/halforms/` | **HZN-2.4**                               | Already partially done per PR #54; WI-12 depends on these handlers being complete                                                                                                                                                                                   |
