# Recorded ContentGrid model

`recorded-dump.json` is a snapshot of a real ContentGrid dev application's HAL API, used to run the
dev apps and the e2e suite on a realistic data model instead of hand-built stubs.

## What is in it

`{ capturedAt, responses }`, where `responses` is keyed by request path:

- `/profile` — the profile root (`cg:entity` links)
- `/profile/<plural>` — entity profiles (attributes, relations, `_templates`), fetched with
  `Accept: application/prs.hal-forms+json`
- `/<plural>?size=5` — the first page of each collection (with `page.total_items_exact`)
- `/<plural>/<id>` — one full item per entity

## Sanitised

- The tenant origin is replaced by the fake `https://recorded.navigator.test`; the MSW demo handlers
  (`../msw/demo-handlers.ts`) rewrite it to their `baseUrl` at serve time.
- Audit and author fields use neutral pseudonyms (`User A`, ..., `Service Account`).
- Personal-looking values (names, emails, dates of birth) and content filenames are replaced with
  deterministic placeholders.

## Scope

For local development and e2e only. It must never be imported from production code or end up in a
production bundle; the dev apps load it only behind their MSW mock gate.

## Re-recording

Fetch the paths above from a dev application with a Bearer token (profile and item requests with
`Accept: application/prs.hal-forms+json`), then sanitise the result the same way as above before
committing: no tenant host, no real names, emails, or filenames.
