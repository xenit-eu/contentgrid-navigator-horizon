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
