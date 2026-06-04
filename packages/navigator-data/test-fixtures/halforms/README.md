# HAL-FORMS Entity-Profile Fixtures

Anonymised HAL-FORMS entity-profile fixtures — one JSON file per entity profile plus
`_profile-root.json` — crawled from the ContentGrid test application and host-anonymised
to `https://api.example.contentgrid.com`.

## Format

Each file is the raw `application/prs.hal-forms+json` profile response shape as returned
by `GET /profile/<entity>`. It contains:

- `_links` — hypermedia links (e.g. `describes`, `self`, `curies`)
- `_templates` — HAL-FORMS templates (`create-form`, `search`, `default`, `delete`, …)
- `_embedded` (optional) — embedded resources where present

`_profile-root.json` is the `GET /profile` root response (lists all entity profile links).

## Consumers

| Ticket   | Usage                                       |
| -------- | ------------------------------------------- |
| HZN-2.4  | MSW handler stubs for HAL-FORMS responses   |
| HZN-5A.6 | Round-trip parity tests (parse → serialise) |
| HZN-5D.7 | Profile-driven form rendering tests         |

## Entity files

- `_profile-root.json`
- `all-attribute.json`
- `all-required.json`
- `create-allowed.json`
- `customer.json`
- `employee.json`
- `empty.json`
- `many-relation.json`
- `not-allowed.json`
- `order.json`
- `partially-allowed.json`
- `product.json`
- `read-allowed.json`
- `related-item.json`
- `supplier.json`
- `update-allowed.json`

---

## Entity-item fixtures (update templates)

Located in `items/`. These are entity-**item** resources (`GET /{plural}/{id}`), not entity-profile resources. Each file is the full HAL item response body (including `_templates` and `_links`), anonymised to `https://api.example.contentgrid.com`, with synthetic test values (no PII).

### Files

- `items/all-attribute-item.json` — item with every supported attribute type (text, number, boolean, datetime, content); templates: `default` (PUT json), `delete`
- `items/order-item.json` — order item with two content attributes and two relations; templates: `default` (PUT json), `delete`, `add-products`, `clear-products`, `set-customer`, `clear-customer`
- `items/employee-item.json` — employee item with two to-many and two to-one self-relations; templates: `default` (PUT json), `delete`, `add-colleague`, `clear-colleague`, `set-boss`, `clear-boss`, `add-managed_orders`, `clear-managed_orders`
- `items/customer-item.json` — customer item with one to-many relation; templates: `default` (PUT json), `delete`, `add-orders`, `clear-orders`

### What these fixtures represent

**`default` template (update form)**

Method PUT, `contentType: application/json`. Properties are the writable scalar attributes. No `readOnly` and no template-level `value` prefill — these are absent from item-level update templates just as from profile-level `create-form`. Edit-form prefill is client-side, sourced from the item body's current attribute values.

Content/file attributes appear as dot-notation pairs — `<attr>.filename` (type `text`) and `<attr>.mimetype` (type `text`) — rather than a single `file`-type property. This contrasts with `create-form`, where the same content attribute is a `file`-typed property that triggers `multipart/form-data`.

Relations are **not** included in `default`; they have dedicated templates.

**Relation-mutation templates**

- `set-<rel>` — PUT, `contentType: text/uri-list`, one `url`-typed property with `options.link` → target collection and `maxItems: 1` (to-one)
- `add-<rel>` — POST, `contentType: text/uri-list`, one `url`-typed property with `options.link` → target collection, no `maxItems` (to-many)
- `clear-<rel>` — DELETE, no properties

**`delete` template**

Method DELETE, no properties.

**Audit fields**

`created_by`, `created_date`, `last_modified_by`, `last_modified_date` are nested under an `audit_metadata` object in the item body. They are **not present in any `_templates` property** — read-only data in the body only, omitted from all forms.

### Consumers

| Ticket   | Usage                                                                |
| -------- | -------------------------------------------------------------------- |
| HZN-2.4  | MSW handler stubs for entity-item HAL responses (update path)        |
| HZN-5A.6 | Round-trip parity tests for update-form `FieldDescriptor` resolution |
