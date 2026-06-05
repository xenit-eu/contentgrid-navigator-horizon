# Entity Profile `_templates` Inventory

Catalogues every `_templates` shape observed in the ContentGrid test application profile API,
maps each to a planned `FieldDescriptor` kind for HZN-5A.1, and confirms full parseability
by `@contentgrid/hal-forms` `resolveTemplate`.

| Metadata          | Value                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| Jira ticket       | ACC-2845 / HZN-0.5.2                                                              |
| Date              | 2026-06-04                                                                        |
| Source app        | ContentGrid test application (deployment id redacted)                             |
| Entity count      | 15                                                                                |
| Dump file         | `packages/navigator-data/test-fixtures/entity-profiles/entity-profiles-dump.json` |
| HAL-Forms library | `@contentgrid/hal-forms@0.4.2`                                                    |

---

## 1. Methodology

The dump was produced by crawling the live test application's HAL-FORMS profile API with authenticated requests:

1. `GET /profile` (profile root) — enumerates all `cg:entity` links.
2. `GET /profile/{plural}` for each of the 15 entity links — returns the full HAL-FORMS profile including `_embedded` schema descriptors and `_templates`.

The resulting JSON was saved verbatim to the dump file. All snippets in this document are copied directly from that file; nothing is inferred or constructed.

`HalFormsPropertyType` from `@contentgrid/hal-forms@0.4.2` is used as the canonical type taxonomy throughout. The resolved `HalFormsProperty` API (exposed by `resolveTemplate` / `resolveTemplateRequired`) is the intended consumption layer; `FieldDescriptor` is a presentation-layer projection on top of it.

---

## 2. Entity Inventory

All 15 entities expose exactly three template keys: `default`, `search`, and `create-form`.

| Entity name         | Collection path       | `default` method | `search` method | `create-form` contentType |
| ------------------- | --------------------- | ---------------- | --------------- | ------------------------- |
| `customer`          | `/customers`          | HEAD             | GET             | `application/json`        |
| `create-allowed`    | `/create-alloweds`    | HEAD             | GET             | `application/json`        |
| `order`             | `/orders`             | HEAD             | GET             | `multipart/form-data`     |
| `supplier`          | `/suppliers`          | HEAD             | GET             | `application/json`        |
| `all-attribute`     | `/all-attributes`     | HEAD             | GET             | `multipart/form-data`     |
| `read-allowed`      | `/read-alloweds`      | HEAD             | GET             | `application/json`        |
| `all-required`      | `/all-requireds`      | HEAD             | GET             | `application/json`        |
| `related-item`      | `/related-items`      | HEAD             | GET             | `application/json`        |
| `many-relation`     | `/many-relations`     | HEAD             | GET             | `application/json`        |
| `employee`          | `/employees`          | HEAD             | GET             | `application/json`        |
| `empty`             | `/empties`            | HEAD             | GET             | `application/json`        |
| `partially-allowed` | `/partially-alloweds` | HEAD             | GET             | `application/json`        |
| `product`           | `/products`           | HEAD             | GET             | `application/json`        |
| `not-allowed`       | `/not-alloweds`       | HEAD             | GET             | `application/json`        |
| `update-allowed`    | `/update-alloweds`    | HEAD             | GET             | `application/json`        |

**`default` template note.** Every `default` template has `method: "HEAD"` and `properties: []`. It is a capability/existence probe — its presence indicates the entity collection is reachable. It carries no field definitions. Editable update templates (e.g. `default` with method PUT/PATCH) live on entity-_item_ resources, which are not included in this profile dump. This document covers profile-level templates only.

**`multipart/form-data` trigger.** The `create-form` contentType flips to `multipart/form-data` when the entity has at least one `file`-typed property. In this dump that applies to `order` (file fields `document`, `receipt`) and `all-attribute` (file field `content`).

---

## 3. Canonical Type Coverage

`HalFormsPropertyType` in `@contentgrid/hal-forms@0.4.2` defines exactly 13 values.

| Type             | Present in dump | Example reference                                                        |
| ---------------- | --------------- | ------------------------------------------------------------------------ |
| `text`           | YES             | `customer.create-form.name`, `all-attribute.search.text`                 |
| `number`         | YES             | `order.create-form.total_amount`, `all-attribute.search.long`            |
| `datetime`       | YES             | `order.create-form.order_date`, `all-attribute.search.datetime`          |
| `checkbox`       | YES             | `all-attribute.create-form.boolean`, `all-required.create-form.req_bool` |
| `file`           | YES             | `order.create-form.document`, `all-attribute.create-form.content`        |
| `url`            | YES             | `order.create-form.customer`, `employee.create-form.colleague`           |
| `hidden`         | absent          | —                                                                        |
| `email`          | absent          | —                                                                        |
| `date`           | absent          | —                                                                        |
| `time`           | absent          | —                                                                        |
| `datetime-local` | absent          | —                                                                        |
| `range`          | absent          | —                                                                        |
| `radio`          | absent          | —                                                                        |

Only 6 of 13 canonical types appear. The `FieldDescriptor` design must account for all 13 regardless; the 7 absent types are addressed in Section 9.

**Blueprint → HAL-Forms type collapse.**
The ContentGrid profile API uses blueprint-level types (`long`, `double`, `boolean`, `datetime`, `string`, `object`) which the Application Server maps down to HAL-Forms types before serialising templates:

- `string` → `text`
- `long` / `double` → `number`
- `boolean` → `checkbox`
- `datetime` → `datetime`
- `object` (content attribute) → `file`
- relation field → `url`

---

## 4. Distinct Shape Catalog

The central deliverable. Each row is a unique combination of (template, type, options-shape, required). A verbatim example snippet from the dump accompanies each shape.

### Shape 1 — `create-form`, `text`, no options, `required: false`

Plain single-line text input. The most common shape in the dump (≈18 occurrences across all entities).

```json
{
  "name": "name",
  "prompt": "Name",
  "type": "text"
}
```

_Source: `customer.create-form.name`_

### Shape 2 — `create-form`, `text`, no options, `required: true`

Required plain text input. The `required` field is present and `true`.

```json
{
  "name": "reqtest",
  "prompt": "Reqtest",
  "required": true,
  "type": "text"
}
```

_Source: `all-required.create-form.reqtest`_

### Shape 3 — `create-form`, `text`, `options.inline` (string[]), `maxItems: 1`

Single-select enum. The `inline` array holds plain strings; `maxItems: 1` enforces single-select.

```json
{
  "name": "constrained_text",
  "prompt": "Constrained text",
  "type": "text",
  "options": {
    "minItems": 0,
    "maxItems": 1,
    "inline": ["Constraint A", "Constraint B", "Constraint C"]
  }
}
```

_Source: `all-attribute.create-form.constrained_text`_

Also seen on `employee.create-form.position` (inline: `["Administration", "Boss", "Order Manager"]`).

### Shape 4 — `create-form`, `number`, no options, `required: false`

Numeric input (covers blueprint `long` and `double`).

```json
{
  "name": "total_amount",
  "prompt": "Total amount",
  "type": "number"
}
```

_Source: `order.create-form.total_amount`_

Also: `all-attribute.create-form.long`, `all-attribute.create-form.double`, `product.create-form.price`.

### Shape 5 — `create-form`, `number`, no options, `required: true`

Required numeric input.

```json
{
  "name": "req_int",
  "prompt": "Req int",
  "required": true,
  "type": "number"
}
```

_Source: `all-required.create-form.req_int`_

### Shape 6 — `create-form`, `datetime`, no options, `required: false`

Datetime picker input.

```json
{
  "name": "order_date",
  "prompt": "Order date",
  "type": "datetime"
}
```

_Source: `order.create-form.order_date`_

Also: `all-attribute.create-form.datetime`.

### Shape 7 — `create-form`, `datetime`, no options, `required: true`

Required datetime picker input.

```json
{
  "name": "req_datum",
  "prompt": "Req datum",
  "required": true,
  "type": "datetime"
}
```

_Source: `all-required.create-form.req_datum`_

### Shape 8 — `create-form`, `checkbox`, no options, `required: false`

Boolean toggle / checkbox.

```json
{
  "name": "boolean",
  "prompt": "Boolean",
  "type": "checkbox"
}
```

_Source: `all-attribute.create-form.boolean`_

Also: `partially-allowed.create-form.allowed`.

### Shape 9 — `create-form`, `checkbox`, no options, `required: true`

Required boolean toggle.

```json
{
  "name": "req_bool",
  "prompt": "Req bool",
  "required": true,
  "type": "checkbox"
}
```

_Source: `all-required.create-form.req_bool`_

### Shape 10 — `create-form`, `file`, no options

Binary file upload. Presence of this shape on any create-form property triggers `contentType: multipart/form-data` on the template.

```json
{
  "name": "document",
  "prompt": "Document",
  "type": "file"
}
```

_Source: `order.create-form.document`_

Also: `order.create-form.receipt`, `all-attribute.create-form.content`.

### Shape 11 — `create-form`, `url`, `options.link` (remote) + `maxItems: 1`

To-one relation picker. `maxItems: 1` enforces a single link. `valueField: "/_links/self/href"` tells the client which field in the remote item resource holds the value to submit.

```json
{
  "name": "customer",
  "prompt": "Customer",
  "type": "url",
  "options": {
    "link": {
      "href": "https://api.example.contentgrid.com/customers",
      "title": "Customers"
    },
    "minItems": 0,
    "maxItems": 1,
    "valueField": "/_links/self/href"
  }
}
```

_Source: `order.create-form.customer`_

Also: `employee.create-form.boss`, `many-relation.create-form.related_item_optional`, `related-item.create-form.receiver_many_related_items`.

### Shape 12 — `create-form`, `url`, `options.link` (remote), no `maxItems`

To-many relation picker. Absence of `maxItems` means unbounded multi-selection.

```json
{
  "name": "orders",
  "prompt": "Orders",
  "type": "url",
  "options": {
    "link": {
      "href": "https://api.example.contentgrid.com/orders",
      "title": "Orders"
    },
    "minItems": 0,
    "valueField": "/_links/self/href"
  }
}
```

_Source: `customer.create-form.orders`_

Also: `order.create-form.products`, `employee.create-form.colleague`, `employee.create-form.managed_orders`, `many-relation.create-form.many_related_items`.

### Shape 13 — `search`, `text`, no options (exact or prefix filter)

Plain text filter input in the search template. The operator is encoded in a `~suffix` on the property name (see Section 5 for the full suffix table). `name` with no suffix = exact-match; `name~prefix` = prefix-match.

```json
{
  "name": "email",
  "prompt": "Email",
  "type": "text"
}
```

_Source: `customer.search.email` (exact-match)_

```json
{
  "name": "name~prefix",
  "prompt": "Name",
  "type": "text"
}
```

_Source: `customer.search.name~prefix` (prefix-match)_

### Shape 14 — `search`, `number`, no options (numeric filter including range variants)

Typed numeric filter. The `~suffix` encodes the comparison operator.

```json
{
  "name": "long~gt",
  "prompt": "Long: Greater than",
  "type": "number"
}
```

_Source: `all-attribute.search.long~gt`_

```json
{
  "name": "long~gte",
  "prompt": "Long: Min",
  "type": "number"
}
```

_Source: `all-attribute.search.long~gte`_

### Shape 15 — `search`, `datetime`, no options (datetime filter including range variants)

Typed datetime filter.

```json
{
  "name": "datetime~after",
  "prompt": "Datetime: After",
  "type": "datetime"
}
```

_Source: `all-attribute.search.datetime~after`_

```json
{
  "name": "datetime~before",
  "prompt": "Datetime: Before",
  "type": "datetime"
}
```

_Source: `all-attribute.search.datetime~before`_

### Shape 16 — `search`, `checkbox`, no options (boolean filter)

Boolean filter.

```json
{
  "name": "boolean",
  "prompt": "Boolean",
  "type": "checkbox"
}
```

_Source: `all-attribute.search.boolean`_

### Shape 17 — `search`, `text`, `options.inline` (string[]), `maxItems: 1` (enum filter)

Single-select enum filter in the search template.

```json
{
  "name": "constrained_text",
  "prompt": "Constrained text",
  "type": "text",
  "options": {
    "minItems": 0,
    "maxItems": 1,
    "inline": ["Constraint A", "Constraint B", "Constraint C"]
  }
}
```

_Source: `all-attribute.search.constrained_text`_

### Shape 18 — `search`, `text`, `options.inline` (object[]), no `maxItems` — `_sort` pseudo-property

Present on every search template that has sortable attributes (10 of 15 entities). The `inline` array contains sort-option objects; `promptField`/`valueField` tell the client how to render and submit them. No `maxItems` means the sort is repeatable (multi-column sort supported).

```json
{
  "name": "_sort",
  "prompt": "Sort",
  "type": "text",
  "options": {
    "minItems": 0,
    "promptField": "prompt",
    "valueField": "value",
    "inline": [
      {
        "property": "email",
        "direction": "asc",
        "prompt": "Email A→Z",
        "value": "email,asc"
      },
      {
        "property": "email",
        "direction": "desc",
        "prompt": "Email Z→A",
        "value": "email,desc"
      }
    ]
  }
}
```

_Source: `customer.search._sort`_

---

## 5. Search Template Specifics

### 5.1 `~suffix` Operator Convention

The search template encodes filter operators by appending a `~suffix` to the property name. The base name (before any suffix) identifies the attribute; the suffix identifies the comparison. Cross-entity suffix counts observed in the dump:

| Suffix    | Operator                  | Applicable types                         | Count in dump |
| --------- | ------------------------- | ---------------------------------------- | ------------- |
| _(none)_  | `exact`                   | `text`, `number`, `datetime`, `checkbox` | 26            |
| `~prefix` | `prefix-match`            | `text`                                   | 21            |
| `~gt`     | `greater-than`            | `number`                                 | 4             |
| `~gte`    | `greater-than-or-equal`   | `number`                                 | 4             |
| `~lt`     | `less-than`               | `number`                                 | 4             |
| `~lte`    | `less-than-or-equal`      | `number`                                 | 4             |
| `~after`  | `greater-than` (datetime) | `datetime`                               | 1             |
| `~before` | `less-than` (datetime)    | `datetime`                               | 1             |

**Parsing rule:** to extract the attribute name and operator from a search property name, split on `~`. If no `~` is present the operator is `exact`. Relation-traversal filters use dot-notation on the base name (e.g. `customer.email` = attribute `email` on related entity `customer`, operator `exact`; `products.product_name~prefix` = prefix-match on the related entity's `product_name`). The dot-prefix is part of the _name_, not the suffix.

Example of a relation-traversal filter:

```json
{
  "name": "customer.name~prefix",
  "prompt": "Customer: Name",
  "type": "text"
}
```

_Source: `order.search.customer.name~prefix`_

### 5.2 `_sort` Object-Enum

The `_sort` property is technically typed as `text` but its `options.inline` array contains objects rather than strings. Each element has four fields:

| Field       | Type                | Meaning                                                                                  |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `property`  | string              | The sortable attribute name                                                              |
| `direction` | `"asc"` \| `"desc"` | Sort direction                                                                           |
| `prompt`    | string              | Human-readable label (used as `promptField`)                                             |
| `value`     | string              | The query-param value to submit, format `{attribute},{direction}` (used as `valueField`) |

Full example from `all-attribute.search._sort`:

```json
{
  "name": "_sort",
  "prompt": "Sort",
  "type": "text",
  "options": {
    "minItems": 0,
    "promptField": "prompt",
    "valueField": "value",
    "inline": [
      { "property": "text", "direction": "asc", "prompt": "Text A→Z", "value": "text,asc" },
      { "property": "text", "direction": "desc", "prompt": "Text Z→A", "value": "text,desc" },
      { "property": "long", "direction": "asc", "prompt": "Long 0→9", "value": "long,asc" },
      { "property": "long", "direction": "desc", "prompt": "Long 9→0", "value": "long,desc" },
      { "property": "double", "direction": "asc", "prompt": "Double 0→9", "value": "double,asc" },
      { "property": "double", "direction": "desc", "prompt": "Double 9→0", "value": "double,desc" },
      {
        "property": "boolean",
        "direction": "asc",
        "prompt": "Boolean ascending",
        "value": "boolean,asc"
      },
      {
        "property": "boolean",
        "direction": "desc",
        "prompt": "Boolean descending",
        "value": "boolean,desc"
      },
      {
        "property": "datetime",
        "direction": "asc",
        "prompt": "Datetime oldest first",
        "value": "datetime,asc"
      },
      {
        "property": "datetime",
        "direction": "desc",
        "prompt": "Datetime newest first",
        "value": "datetime,desc"
      },
      {
        "property": "constrained_text",
        "direction": "asc",
        "prompt": "Constrained text A→Z",
        "value": "constrained_text,asc"
      },
      {
        "property": "constrained_text",
        "direction": "desc",
        "prompt": "Constrained text Z→A",
        "value": "constrained_text,desc"
      }
    ]
  }
}
```

This is the **only genuinely multi-valued options shape** in the dump. All other multi-value shapes are to-many relations (url type).

---

## 6. Relations — Full Cross-Entity Table

All `url`-typed create-form properties enumerated. Cardinality is derived from `maxItems`:

- `maxItems: 1` = to-one
- `maxItems` absent = to-many

| Source entity       | Relation field                | Target collection     | Cardinality |
| ------------------- | ----------------------------- | --------------------- | ----------- |
| `customer`          | `orders`                      | `/orders`             | to-many     |
| `order`             | `products`                    | `/products`           | to-many     |
| `order`             | `customer`                    | `/customers`          | to-one      |
| `supplier`          | `products`                    | `/products`           | to-many     |
| `related-item`      | `receiver_many_related_items` | `/many-relations`     | to-one      |
| `many-relation`     | `related_item_optional`       | `/related-items`      | to-one      |
| `many-relation`     | `many_related_items`          | `/related-items`      | to-many     |
| `many-relation`     | `one_relation`                | `/many-relations`     | to-one      |
| `many-relation`     | `received_relation`           | `/many-relations`     | to-one      |
| `many-relation`     | `many_self_relations`         | `/many-relations`     | to-one      |
| `many-relation`     | `many_self_relations_inverse` | `/many-relations`     | to-one      |
| `many-relation`     | `many_to_one_items`           | `/related-items`      | to-one      |
| `many-relation`     | `many_not_allowed`            | `/not-alloweds`       | to-many     |
| `many-relation`     | `many_partially_allowed`      | `/partially-alloweds` | to-many     |
| `employee`          | `colleague`                   | `/employees`          | to-many     |
| `employee`          | `boss`                        | `/employees`          | to-one      |
| `employee`          | `managed_orders`              | `/orders`             | to-many     |
| `partially-allowed` | `relations`                   | `/many-relations`     | to-many     |

Total: 18 relation properties across 7 source entities.

---

## 7. Enums and Options Shapes

### 7.1 Cardinality Encoding Rule

For both enum and relation options, `maxItems` is the sole cardinality signal:

| `maxItems` value | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `1`              | Single-valued (to-one relation; single-select enum)                 |
| absent           | Multi-valued (to-many relation; multi-select enum; repeatable sort) |

`minItems` is always `0` in this dump — no options field is mandatory at the HAL-Forms level (required field is used for that on the property itself).

### 7.2 String Enum (inline string[])

Two contexts:

- **create-form** (Shape 3): `type: text`, `options.inline` = string[], `maxItems: 1`. Observed on `all-attribute.constrained_text` and `employee.position`.
- **search template** (Shape 17): same shape — `type: text`, `options.inline` = string[], `maxItems: 1`. Observed on `all-attribute.search.constrained_text`.

No true multi-select string enum exists in this dump (that would require `inline` = string[] with `maxItems` absent or `>1`). The `FieldDescriptor` design must reserve space for it, but it has no production examples here.

### 7.3 Sort Object-Enum (inline object[])

Only in `search._sort` (Shape 18). Type is `text`, `options.inline` = object[], no `maxItems`, `promptField: "prompt"`, `valueField: "value"`. This is the one shape where `multiValue` is genuinely `true` for a non-relation property: a user may select multiple sort columns.

---

## 8. Gaps and Absences

These shapes are absent from this application's data but the HAL-Forms taxonomy and/or ContentGrid platform design supports them. The `FieldDescriptor` design must account for them.

### 8.1 Absent HAL-Forms types

`hidden`, `email`, `date`, `time`, `datetime-local`, `range`, `radio` are not present in any property in the dump. The platform currently maps blueprint types to only 6 HAL-Forms types (see Section 3). This may change as the platform evolves.

### 8.2 Absent property-level constraints — now confirmed across both profile and item-level templates

The following `HalFormsPropertyShape` fields are defined by the spec but not set on any property in this dump. This table now covers **both** the profile-level `create-form`/`search` templates **and** entity-item update templates (the `default` PUT template on `/{plural}/{id}`), which were crawled for 4 representative entities (all-attribute, order, employee, customer) — see §8.6 below and the committed fixtures at `packages/navigator-data/test-fixtures/halforms/items/`.

| Field       | Observed in any template (profile or item)? | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readOnly`  | **NO — confirmed absent on all templates**  | Audit fields (`created_by`, `created_date`, `last_modified_by`, `last_modified_date`) are **omitted** from all `_templates` entirely. They live in the entity-item body under a nested `audit_metadata` object and are read-only data, not template properties. The item-level `default` (PUT) template was crawled for 4 entities and carries **no `readOnly` properties**. The original navigator's `jsonforms.ts:197` `readOnly: property.readOnly` passthrough is defensive dead code in practice — no production template ever sets it. |
| `regex`     | NO                                          | No pattern constraints in any template. Not handled by the original translator either — genuinely absent.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `minLength` | NO                                          | Genuinely absent (not handled by the original translator).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `maxLength` | NO                                          | Genuinely absent (not handled by the original translator).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `value`     | **NO — confirmed absent on all templates**  | No pre-filled `value` on any `create-form`, `search`, or item-level `default` (update) template property. Edit-form prefill is **client-side**: the client reads the current attribute values from the entity-item body and populates the form from those — the template itself carries no `value` field. The original navigator's `jsonforms.ts:118` `values.value(property.name).value` reads the item-body values, not a template `value` field.                                                                                          |

The `FieldDescriptor` base type must carry slots for all these fields to remain forward-compatible.

**Item-level crawl note.** Item-level update templates (`default` PUT/json) and relation-mutation templates were crawled for 4 representative entities (all-attribute, order, employee, customer) and are committed as fixtures at `packages/navigator-data/test-fixtures/halforms/items/`. The conclusion "no `readOnly`, no template-level `value`" now holds empirically across **both** create-form and update templates.

### 8.3 No true multi-select string enum

Only `maxItems: 1` string enums appear. A multi-select enum (`inline` = string[] with `maxItems` absent or `>1`) does not exist in this application. Reserve `multiValue: true` on the `"enum"` descriptor for it.

### 8.4 No conditional/visibility rules

The ticket's "conditionals" acceptance criterion resolves to: **no conditional property visibility or conditional required logic exists in production profile data.** HAL-Forms as used here has no mechanism for showing/hiding properties based on other field values. The `FieldDescriptor` design need not implement conditionals for Phase 5A.1; note the absence as a known gap.

### 8.5 `default` template is not an update form at profile scope

The `default` template on profile resources carries `method: HEAD` and `properties: []`. The actual update `default` template (method PUT, `application/json`, with properties) lives on individual entity-item resources (`GET /{plural}/{id}`). See §8.6 for the full empirical inventory of item-level template shapes.

### 8.6 Entity-item (update) template shapes — empirical inventory

Item-level templates were crawled from 4 representative entity-item resources. Fixtures at `packages/navigator-data/test-fixtures/halforms/items/`.

#### `default` — update form (PUT, `application/json`)

Present on all entity-item resources. Method is always PUT; `contentType` is always `application/json` — even for entities with content/file attributes (e.g. `order`, `all-attribute`), because the update form edits scalar metadata only, not the binary content.

Properties are the writable scalar attributes. **No `readOnly` and no template-level `value`** on any property (confirmed for all 4 crawled entities). Relations are excluded from `default`.

Content/file attributes have a **dual representation**:

- On `create-form` (profile level): a single `file`-typed property (e.g. `"name": "document"`, `"type": "file"`), which flips the template to `multipart/form-data`.
- On `default` (item level): two `text`-typed dot-notation properties — `<attr>.filename` and `<attr>.mimetype` — for editing the content metadata. The binary is not re-uploaded via the update form.

Example (`order` entity — `default` properties, content attributes as dot-notation):

```json
{
  "name": "document.filename",
  "prompt": "Document filename",
  "type": "text"
},
{
  "name": "document.mimetype",
  "prompt": "Document mimetype",
  "type": "text"
},
{
  "name": "receipt.filename",
  "prompt": "Receipt filename",
  "type": "text"
},
{
  "name": "receipt.mimetype",
  "prompt": "Receipt mimetype",
  "type": "text"
}
```

The resolver/renderer must handle both representations for the same content attribute depending on which template is being rendered.

#### `delete` — entity deletion

Method DELETE, `contentType` absent, `properties: []`. Present on all entity-item resources.

#### `set-<rel>` — to-one relation assignment

Method PUT, `contentType: text/uri-list`. One `url`-typed property with `options.link` → target collection href and `maxItems: 1`. Named `set-<relation-name>` (e.g. `set-customer`, `set-boss`).

```json
{
  "name": "set-customer",
  "method": "PUT",
  "contentType": "text/uri-list",
  "properties": [
    {
      "name": "customer",
      "prompt": "Customer",
      "type": "url",
      "options": {
        "link": { "href": "https://api.example.contentgrid.com/customers", "title": "Customers" },
        "minItems": 0,
        "maxItems": 1,
        "valueField": "/_links/self/href"
      }
    }
  ]
}
```

#### `add-<rel>` — to-many relation member addition

Method POST, `contentType: text/uri-list`. One `url`-typed property with `options.link` → target collection href, **no `maxItems`**. Named `add-<relation-name>` (e.g. `add-products`, `add-colleague`, `add-managed_orders`, `add-orders`).

```json
{
  "name": "add-products",
  "method": "POST",
  "contentType": "text/uri-list",
  "properties": [
    {
      "name": "products",
      "prompt": "Products",
      "type": "url",
      "options": {
        "link": { "href": "https://api.example.contentgrid.com/products", "title": "Products" },
        "minItems": 0,
        "valueField": "/_links/self/href"
      }
    }
  ]
}
```

#### `clear-<rel>` — relation removal

Method DELETE, `contentType` absent, `properties: []`. Present for both to-one and to-many relations.

#### Audit fields — body-only, never in templates

`created_by`, `created_date`, `last_modified_by`, `last_modified_date` appear as a nested `audit_metadata` object in the entity-item body:

```json
{
  "audit_metadata": {
    "created_by": "user@example.com",
    "created_date": "2025-01-15T10:00:00Z",
    "last_modified_by": "user@example.com",
    "last_modified_date": "2025-03-20T14:30:00Z"
  }
}
```

These fields are completely absent from all `_templates`. They are display-only data; no form ever submits them.

#### Summary of item-level template keys observed

| Entity          | Template keys                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `all-attribute` | `default`, `delete`                                                                                                             |
| `order`         | `default`, `delete`, `add-products`, `clear-products`, `set-customer`, `clear-customer`                                         |
| `employee`      | `default`, `delete`, `add-colleague`, `clear-colleague`, `set-boss`, `clear-boss`, `add-managed_orders`, `clear-managed_orders` |
| `customer`      | `default`, `delete`, `add-orders`, `clear-orders`                                                                               |

---

## 9. `FieldDescriptor` Mapping — HZN-5A.1

### 9.1 Mapping Table

| Observed HAL-Forms shape                                             | `FieldDescriptor` kind           | Key discriminating fields                                                                                                            |
| -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `create-form`, `text`, no options                                    | `"text"`                         | `name`, `prompt`, `required`, `multiValue: false`                                                                                    |
| `create-form`, `number`, no options                                  | `"number"`                       | `name`, `prompt`, `required`; reserve `min`/`max`/`step` for future range constraints                                                |
| `create-form`, `datetime`, no options                                | `"datetime"`                     | `name`, `prompt`, `required`                                                                                                         |
| `create-form`, `checkbox`, no options                                | `"boolean"`                      | `name`, `prompt`, `required`                                                                                                         |
| `create-form`, `file`, no options                                    | `"file"`                         | `name`, `prompt`; presence drives `multipart/form-data` on containing template                                                       |
| `create-form`, `text` + `options.inline` (string[]) + `maxItems: 1`  | `"enum"`                         | `name`, `prompt`, `required`, `multiValue: false`, `options: string[]`                                                               |
| `create-form`, `text` + `options.inline` (string[]) + no `maxItems`  | `"enum"`                         | `name`, `prompt`, `required`, `multiValue: true`, `options: string[]` _(reserved — not in data)_                                     |
| `create-form`, `url` + `options.link` + `maxItems: 1`                | `"relation"`                     | `name`, `prompt`, `required`, `cardinality: "to-one"`, `targetHref: options.link.href`, `valueField`                                 |
| `create-form`, `url` + `options.link` + no `maxItems`                | `"relation"`                     | `name`, `prompt`, `required`, `cardinality: "to-many"`, `targetHref: options.link.href`, `valueField`                                |
| `search`, `text`/`number`/`datetime`/`checkbox`, no options          | `"filter"`                       | `name` (raw, includes suffix), `attributeName` (name before `~`), `operator` (parsed from suffix), `type` (HAL-Forms type), `prompt` |
| `search`, `text` + `options.inline` (string[]) + `maxItems: 1`       | `"filter"` + `options: string[]` | Same as above; `options` drives enum select UI                                                                                       |
| `search._sort`, `text` + `options.inline` (object[]) + no `maxItems` | `"sort"`                         | `options`: array of `{ property, direction, value, prompt }`                                                                         |

### 9.2 Common Base Fields

Every `FieldDescriptor` variant carries these base fields regardless of kind:

| Field        | Source                          | Notes                                                                                      |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `name`       | `property.name`                 | Raw HAL-Forms name including any `~suffix`                                                 |
| `prompt`     | `property.prompt`               | Display label                                                                              |
| `type`       | `property.type`                 | Raw `HalFormsPropertyType` value                                                           |
| `required`   | `property.required ?? false`    | Boolean                                                                                    |
| `readOnly`   | `property.readOnly ?? false`    | Reserved; always `false` in current data                                                   |
| `multiValue` | derived from `options.maxItems` | `true` when `maxItems` is absent; `false` when `maxItems === 1`; `false` when no `options` |
| `regex`      | `property.regex`                | Reserved; always `undefined` in current data                                               |
| `minLength`  | `property.minLength`            | Reserved; always `undefined`                                                               |
| `maxLength`  | `property.maxLength`            | Reserved; always `undefined`                                                               |
| `value`      | `property.value`                | Reserved; always `undefined`                                                               |

### 9.3 Rationale

The `kind` discriminant is a presentation-layer concept — it tells the renderer _what widget to draw_ rather than _what type the server declared_. The mapping is deliberately thin:

- `resolveTemplate` from `@contentgrid/hal-forms` handles raw parsing and normalisation (expanding CURIEs, resolving inline vs. remote options, computing `multiValue`). Every shape in this dump is fully parseable by `resolveTemplate` — no custom parsing is needed.
- `FieldDescriptor` is a projection on top of the resolved `HalFormsProperty`. Its job is to carry widget-selection hints and derived fields (e.g. `cardinality`, `operator`) that live above the HAL-Forms layer, not to replace the parser.
- Blueprint types that collapse to the same HAL-Forms type (`long`/`double` → `number`) are kept under a single `"number"` kind. Any type-specific treatment (integer vs. float step values) should be deferred until the API surfaces it.

### 9.4 `resolveTemplate` Parseability Confirmation

All 18 distinct shapes in Section 4 are parseable by `resolveTemplate` / `resolveTemplateRequired` without extension:

- `text`, `number`, `datetime`, `checkbox`, `file` — standard scalar types; parsed as-is.
- `text` + `options.inline` (string[]) — `resolveTemplate` exposes `options.isInline() === true`; `options.inline` holds the string values.
- `url` + `options.link` — `resolveTemplate` exposes `options.isRemote() === true`; `options.link.href` gives the target collection URL; `multiValue` is derived from `maxItems`.
- `text` + `options.inline` (object[]) (`_sort`) — parsed as an inline options shape; `multiValue: true` (no `maxItems`); the object structure is opaque to `resolveTemplate` and must be handled by the `"sort"` FieldDescriptor consumer.

No shape requires a custom parser or an extension to `@contentgrid/hal-forms`.

---

## 10. Cross-check Against Official Documentation

The findings in this document were verified against the official ContentGrid documentation at [docs.contentgrid.com](https://docs.contentgrid.com/) (read June 2026). **No finding is contradicted by the docs.** Where the docs are silent, this audit is empirical — it was crawled from a live application, and the docs explicitly delegate per-application specifics (notably the full filter set) to each app's `/openapi.yaml`.

### 10.1 Confirmed by the docs

| Finding                                                                                                                             | Source page                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile templates `create-form` + `search`; item `default` = update, plus `delete`, `set-/add-/clear-<relation>`                    | [HAL usage](https://docs.contentgrid.com/guides/09_app_api/03_hal_usage/index.html), [entity-profile HAL](https://docs.contentgrid.com/reference/app-api/entity-profile-hal/index.html)                    |
| `create-form` is POST; uses `multipart/form-data` when content attributes are present                                               | [entity-profile HAL](https://docs.contentgrid.com/reference/app-api/entity-profile-hal/index.html)                                                                                                         |
| Relations = `type:"url"` + `options.link` + `valueField:/_links/self/href`                                                          | [entity-profile HAL](https://docs.contentgrid.com/reference/app-api/entity-profile-hal/index.html), [HAL-FORMS extensions](https://docs.contentgrid.com/reference/app-api/hal-forms-extensions/index.html) |
| `_sort=<attr>,asc\|desc`, repeatable; different filters AND, repeated filter ORs; opaque cursor pagination via `next`/`prev`        | [API usage](https://docs.contentgrid.com/guides/09_app_api/02_api_usage/index.html)                                                                                                                        |
| Content attributes appear as `type:"object"` with nested sub-attributes (e.g. `content.filename`) alongside the `file` upload field | [entity-profile HAL](https://docs.contentgrid.com/reference/app-api/entity-profile-hal/index.html), [Concepts](https://docs.contentgrid.com/concepts/index.html)                                           |

### 10.2 One divergence to note

The docs state entity profiles carry **two** templates (`search` + `create-form`). The crawl observed **three**: every profile also exposes a `default` template with `method: HEAD` and empty `properties` (Section 8.5). This is **not a contradiction** — a `HEAD` no-op probe does not conflict with the two meaningful templates — but it is undocumented. Either the crawled platform version adds an undocumented capability-probe template, or the docs are simplified. Treat the `HEAD` `default` as an empirically-observed artefact, not a doc-backed contract.

### 10.3 Empirical-beyond-docs (correct from the live API, absent from public docs)

These claims are **not denied** by the docs but are also not stated there; this audit is the authority for them:

- **`checkbox` type** for boolean attributes — docs name only `text`/`number`/`datetime`/`url`/`file`.
- **`long`/`double` → `type:"number"`** mapping — not stated in the docs.
- **`maxItems` absent ⇒ to-many** (Section 7.1) — docs show only the `maxItems:1` to-one case; the absence rule is a sound inference, not a documented contract.
- **Search `~suffix` set** (Section 5.1) — docs name only `~after` and delegate the full list to each app's `/openapi.yaml`; the `~prefix`/`~gt`/`~gte`/`~lt`/`~lte`/`~before` suffixes are empirical and match the documented operator _concepts_ (prefix-match, greater-than, …).
- **`options.inline` for allowed-value enums** (Shapes 3/17) — docs use `options.inline` only for `_sort`; this audit extends it to attribute enums.
- **`set-<rel>` uses PUT; `add-<rel>` uses POST — both `text/uri-list`** — the docs confirm that to-one relations are set via PUT `text/uri-list` and to-many members are added via POST `text/uri-list`, but do not state the `set-` vs `add-` template-name convention or the PUT-vs-POST-per-cardinality rule explicitly. The live item crawl (§8.6) **empirically confirms** both: `set-<rel>` always carries `method: PUT` with `maxItems: 1`; `add-<rel>` always carries `method: POST` with no `maxItems`. This audit is now the authoritative source for this convention.
- **No `readOnly` or template-level `value` on any template** — the docs are silent on whether update templates carry `readOnly` or prefilled `value` properties. The item crawl confirms neither appears on any production template (create-form or item `default`). See §8.2 and §8.6.

These are flagged so downstream consumers (HZN-5A.1 / 5D.7) know which contract surfaces are doc-backed versus derived from this specific application's profile dump.

---

## 11. Hand-off Note

This document feeds directly into two downstream tickets:

- **HZN-5A.1 — FieldDescriptor[] design.** The mapping table in Section 9 and the base-field inventory are the primary inputs. The 7 absent HAL-Forms types and the reserved-but-unset property fields (Section 8) define the forward-compatibility surface.
- **HZN-5D.7 — Work-item list.** The 18 relation entries (Section 6) and 18 distinct shapes (Section 4) enumerate the renderer cases that must be covered. The 5 entities with empty `search.properties` (`create-allowed`, `read-allowed`, `all-required`, `empty`, `not-allowed`, `update-allowed`) represent the zero-filter edge case the search template renderer must handle.

The dump file at `packages/navigator-data/test-fixtures/entity-profiles/entity-profiles-dump.json` should be checked in and treated as a stable reference; re-crawling will produce a different result if the test application's data model changes.
