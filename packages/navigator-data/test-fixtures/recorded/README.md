# Recorded ContentGrid model

`recorded-dump.json` is a snapshot of a real ContentGrid dev application's HAL API, used to run the
dev apps and the e2e suite on a realistic data model instead of hand-built stubs.

## What is in it

`{ capturedAt, responses }`, where `responses` is keyed by request path:

- `/profile` — the profile root (`cg:entity` links)
- `/profile/<plural>` — entity profiles (attributes, relations, `_templates`), fetched with
  `Accept: application/prs.hal-forms+json`
- `/<plural>?size=5` — the first page of each collection (with `page.total_items_exact`)
- `/<plural>/<id>` — full items (up to 3 per entity, plus relation targets)
- `/<plural>/<id>/<relation>` — relation sub-resources: to-many pages, and to-one redirects
  (`status` 302 + `location`)
- `/<plural>/<id>/<content>` — content downloads as `bodyBase64`, only when recorded with
  `--with-bytes` (off by default)

Entries are `{ status, contentType, etag, body? | bodyBase64?, location? }`; non-2xx responses are
recorded too. The recorder is GET-only. The committed dump predates the relation recordings; the
demo handlers fall back to generated pagination, empty to-many pages and mimetype-matching
placeholder files (PNG, JPEG, SVG, PDF, else text) wherever nothing is recorded.

## Restricted user (derived, not recorded)

`createDemoHandlers(baseUrl, { user: "restricted" })` derives a permission-limited second user from
the same recording through the declarative `RESTRICTED_POLICY` in `../msw/demo-handlers.ts`. The
dev apps pick it with `VITE_MOCK_USER=restricted` (default `full`). Per entity plural:

| Entity       | Policy                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `products`   | read-only: no `default`/`delete`/`set-*`/`add-*`/`clear-*`/`create-form`; writes 403                       |
| `orderses`   | no delete: no `delete` template; DELETE on the item 403                                                    |
| `categories` | no create: no `create-form`; POST to the collection 403                                                    |
| `articles`   | not readable: empty collection (total 0), item GET 404; profile stays visible                              |
| `customers`  | row-level: about every 3rd item (stable id hash) is invisible: pages, totals, relation pages, item GET 404 |

Notes to check against the real backend:

- The 404/302 shapes (entity item, endpoint, relation item, to-one redirect) were captured from a
  dev application. There is no real 403 sample: the 403 body is synthetic (marked `SYNTHETIC` in
  the code) and should be replaced by a recorded one.
- It is an assumption that an unreadable entity (`articles`) stays in `/profile` and keeps its
  profile; whether the backend hides it is unverified.
- Read-only entities also lose `create-form` and refuse `POST` to the collection.
- Unknown non-GET requests (no policy denial, no handler) answer a problem+json 405 with a console
  warning.

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

Do this against a dev application you may freely read from. The recorder only sends GET requests.

### 1. What the dev app needs

- Linked items for every relation kind: to-one, to-many, many-to-many, and both sides of each.
- Neutral data throughout (no real people, companies or documents). Content attributes with files
  of PDF, DOCX, XLSX, PNG, JPG and SVG types, plus some empty ones, so the recorded item metadata
  covers every mimetype. File contents are not recorded by default.

No restricted user is needed: that user is derived (see above).

### 2. Get a token

Log in to the app in a browser, open DevTools, Application, Local Storage, copy the value of
`oidc.user:*` and take its `access_token`. Save only the token to a local file outside version
control (for example `~/tmp/token.txt`). Tokens last about five minutes, so get the token right
before you run the recorder. Never commit the token file.

### 3. Record and sanitise

From this directory (`packages/navigator-data/test-fixtures/recorded/scripts`):

```sh
node record.mjs --base https://<app origin> --token ~/tmp/token.txt --out ~/tmp/raw.json
node sanitise.mjs --in ~/tmp/raw.json --out ../recorded-dump.json --origin https://<app origin>
```

`--with-bytes` makes the recorder download content files too. Leave it off unless the app holds
only neutral files: file contents cannot be sanitised and this repository is going open source.
Without bytes the handlers serve mimetype-matching placeholders.

Keep the raw file outside the repository and delete it afterwards. `record.mjs --help` lists the
options; the recorder exits 2 if requests were answered 401 (token expired mid-run, record again).

The sanitiser rewrites the tenant origin to `https://recorded.navigator.test`, pseudonymises audit
users (`User A`, ..., `Service Account`), emails (`user-N@example.test`), person names, birth
dates and content filenames (`file-N.ext`), and finishes with a leftover scan: tenant host, emails
not ending in `example.test`, JWT-looking strings and `Bearer `. Any hit is listed, the exit code is
non-zero, and nothing is written. Fix the cause (a sanitiser rule, or the source data) and re-run.

### 4. Review before committing

The scan is a safety net, not a guarantee. Skim the diff for names in free text or titles. Then
run `pnpm -r typecheck`, the navigator-data tests and the Playwright specs that use the demo
handlers (`apps/navigator/tests/search-state.spec.ts`, `smoke.spec.ts`), and try the app with
`VITE_MOCK_USER=restricted`.

### Nothing customer- or tenant-specific in the repo

This repository is going open source. The tenant host, user names, emails, file names and contents,
and anything that identifies a customer or tenant must not end up in the dump, the scripts, commit
messages, PR descriptions or docs, and do not mention any customer anywhere. Use only neutral
example data, and never commit a token or a raw (unsanitised) recording.
