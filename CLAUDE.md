# ContentGrid Navigator Horizon — Project Guidance for Claude Code

This file is loaded automatically by Claude Code in every session for this repo. It captures the core principles, conventions, and architectural rules for both the ContentGrid platform and this specific implementation. All implementation MUST follow these principles.

This is a **pnpm monorepo** (`pnpm-workspace.yaml`) with:

- `apps/navigator` — main Navigator app
- `apps/navigator-experimental` — experimental features
- `packages/features`, `packages/navigator-data`, `packages/ui`, `packages/eslint-config`, `packages/tsconfig` — shared packages

---

## Dependency Management

- **NEVER install the `latest` version of an npm package.** Do not run `pnpm add <pkg>@latest` or `pnpm add <pkg>` without a version, and never use `"latest"`/`"*"` as a version range in `package.json`. Always pin to an explicit, known version (e.g. `pnpm add <pkg>@1.2.3`). Unpinned/`latest` installs make builds non-reproducible and pull in unvetted releases.
- **Always respect the `minimumReleaseAge` set in `pnpm-workspace.yaml`** (currently `20160` minutes = 14 days). Never install a package version that was published more recently than this window, and never lower or bypass the setting (e.g. via `--config.minimumReleaseAge=0` or per-package overrides) to pull in a newer release. This guards against compromised/just-published versions. If a needed version is too new, wait until it ages past the window or pick an older one.
- **Do not disable `blockExoticSubdeps`** (currently `true`), which blocks non-registry (git/tarball/etc.) transitive dependencies.
- **Lifecycle/build scripts are blocked by default** via `approve-builds=false` in `.npmrc` plus an explicit empty `onlyBuiltDependencies: []` allowlist in `pnpm-workspace.yaml`. Never set `dangerouslyAllowAllBuilds`. Never add a package to `onlyBuiltDependencies` without understanding why it needs a build script and getting review — this is a common supply-chain attack vector.
- **The committed `pnpm-lock.yaml` is the source of truth for all dependencies.** CI installs with `--frozen-lockfile`. Never delete or casually regenerate the lockfile, and never use `--no-frozen-lockfile` in CI — doing so would allow silent dependency substitution.
- **GitHub Actions are pinned to full 40-character commit SHAs** (not mutable tags) in `.github/workflows/`. Renovate (via the shared `xenit-eu/contentgrid-renovate-presets` config) keeps those SHA pins and version comments up to date automatically, across all ecosystems. Any new or changed action MUST be SHA-pinned with a human-readable version tag in a trailing comment (e.g. `uses: actions/checkout@<sha> # v4`).
- **CI's `GITHUB_TOKEN` defaults to `permissions: contents: read`** (least privilege) at the top-level workflow scope. Broaden permissions only at the individual job level, only when strictly required, and document why.
- **The exact pnpm version is pinned via `packageManager` in the root `package.json`** (enforced by Corepack). Keep it pinned to a specific version; never use a range or omit it — version drift in the package manager itself can introduce subtle behavior changes.
- **Security-critical files are CODEOWNERS-protected and require review before merging:** `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, and `.github/workflows/**`. Do not bypass review for changes to these files.
  - **Documented exception — Renovate auto-merge:** the Renovate GitHub App is a bypass actor on the main ruleset so its own dependency PRs (minor/patch per the shared preset) can auto-merge once all required checks pass, without human code-owner review. The supply-chain gate for these updates is the 14-day `minimumReleaseAge` window plus green CI, not manual review. This bypass applies ONLY to the Renovate app; humans (and Claude) must never use or extend it, and major updates still require human review.

---

## Onboarding reading order for AI agents

Read in this order before writing any code:

1. **This file** — platform concepts, HAL API structure, auth, error handling, naming conventions.
2. **Per-package/per-app `CLAUDE.md` files** — package-specific rules and forbidden imports:
   - [`packages/ui/CLAUDE.md`](packages/ui/CLAUDE.md) — shadcn-CLI usage, primitive vs. pattern boundary, forbidden imports.
   - [`packages/navigator-data/CLAUDE.md`](packages/navigator-data/CLAUDE.md) — HAL hook conventions, ETag pattern, peerDep policy.
   - [`packages/features/CLAUDE.md`](packages/features/CLAUDE.md) — `x-stability` flag mechanism and promotion workflow.
   - [`apps/navigator/CLAUDE.md`](apps/navigator/CLAUDE.md) — generic track rules (stable features only).
   - [`apps/navigator-experimental/CLAUDE.md`](apps/navigator-experimental/CLAUDE.md) — experimental track rules.
3. **Architecture Decision Records** in [`docs/adr/`](docs/adr/README.md):
   - [ADR-001](docs/adr/ADR-001-state-management-zustand-tanstack-query.md) — State management: Zustand (client) + TanStack Query (server).
   - [ADR-002](docs/adr/ADR-002-monorepo-tooling-pnpm.md) — Monorepo tooling: pnpm workspaces only.
   - [ADR-003](docs/adr/ADR-003-ui-stack-tailwind-shadcn.md) — UI stack: Tailwind v4 + shadcn/ui; primitive vs. pattern boundary.
   - [ADR-004](docs/adr/ADR-004-drop-jsonforms-halforms-renderer.md) — Forms: drop JSONForms; HAL-Forms → shadcn renderer.
   - [ADR-005](docs/adr/ADR-005-router-tanstack-router.md) — Router: TanStack Router (file-based, type-safe).
   - [ADR-006](docs/adr/ADR-006-three-track-delivery-model.md) — Three-track delivery model: generic / experimental / custom.
   - [ADR-007](docs/adr/ADR-007-two-layer-dependency-model.md) — Two-layer dependency model: peerDeps + composition layer.
   - [ADR-008](docs/adr/ADR-008-console-scope-ui-publish-trigger.md) — Console scope; `@contentgrid/ui` publish trigger.
   - [ADR-009](docs/adr/ADR-009-visual-regression-playwright-snapshots.md) — Visual regression: Playwright story snapshots.
   - [ADR-010](docs/adr/ADR-010-sequencing-cutover-first.md) — Sequencing: cutover first; OSS and custom scaffolding deferred.
   - [ADR-011](docs/adr/ADR-011-pdf-stack-embedpdf-fallback.md) — PDF stack: `@embedpdf` with pdfjs v5 fallback.
   - [ADR-012](docs/adr/ADR-012-no-shadcn-cli-wrapper.md) — No custom shadcn CLI wrapper; use registry + lint + conventions.
   - [ADR-013](docs/adr/ADR-013-custom-track-private-repo-model.md) — Custom-track delivery: private per-customer repos.
   - [ADR-014](docs/adr/ADR-014-hal-contract-tests-msw.md) — HAL contract tests with MSW.
   - [ADR-015](docs/adr/ADR-015-documentation-surface-split.md) — Documentation surface split.
4. **[`docs/contentgrid-navigator-migration-analysis.md`](docs/contentgrid-navigator-migration-analysis.md)** — feature gap, architectural verdict, delivery model detail.
5. **[`docs/contentgrid-navigator-migration-roadmap.md`](docs/contentgrid-navigator-migration-roadmap.md)** — phase plan, estimates, three-track delivery detail, promotion workflow.

---

## Project Overview

Frontend for [ContentGrid](https://contentgrid.com/) — a cloud Content Services Platform by Xenit/Amexio. Renders a dynamic CRUD interface from a HAL-based REST API. No hardcoded entity names or attributes; everything discovered at runtime via the profile API.

**Key concepts**: Entities have typed attributes (text, number, date, content/files) and relations. Blueprints define the data model; Releases are immutable deployable snapshots. Auth uses ABAC (deny-by-default).

## Tech Stack

React 19 + TypeScript + Vite | TanStack Router (file-based) + Query + Table | shadcn/ui (Radix + Tailwind CSS 4) | `@contentgrid/hal` for HAL parsing | `oidc-client-ts` / `react-oidc-context` for OIDC auth

---

## Core Platform Concepts & Vocabulary

### Organizational Hierarchy

- **Organization**: Top-level container; manages Projects, Applications, and IAM Realms.
- **Project**: Belongs to an Organization; holds the Blueprint, Releases, and deployed Applications.
- **Members**: Project/Org administrators — distinct from end-users (Users).

### Design Artifacts

- **Blueprint**: The design-time application model — defines Data Model, Permissions, and Automations. Contains no user/application data. Not deployable itself.
- **Release**: An immutable, versioned snapshot of a Blueprint (e.g., `v1.2.3`). Once created, a Release never changes. Deployable to Applications.
- **Deployment**: The rollout of a specific Release to an Application.

### Data Model Primitives

- **Entity**: A typed object representing a real-world concept (e.g., `invoice`, `supplier`). Maps to a PostgreSQL table and a REST collection endpoint.
- **Attribute**: A single typed field on an Entity. Types: `string`, `long`, `double`, `boolean`, `date`, `datetime`, `object`, or `content` (file/binary).
- **Relation**: A named link between Entities. Cardinalities: one-to-one, one-to-many, many-to-one, many-to-many.
- **Content attribute**: A special attribute holding binary file data; stored in S3, referenced by the database.

### Runtime Concepts

- **Application**: A running instance of a Project deployed to a Zone; linked to exactly one IAM Realm.
- **Zone**: A deployment target mapping to a cloud provider region (e.g., Scaleway Paris).
- **IAM Realm**: A Keycloak realm holding Users, Groups, Service Accounts, and their attributes.
- **User**: A human principal identified by email, authenticated via OIDC.
- **Group**: Organizes Users; members inherit group attributes used in permission policies.
- **Service Account**: A non-human principal using Client Credentials for programmatic API access.
- **Webhooks**: HTTP notifications sent on data mutations.

---

## HAL API Structure

**CRITICAL**: Entity collection paths use **plural** names from the profile `href` (e.g., `/invoice-products`, `/companies`), NOT the singular `name` field. Always use `EntityInfo.href` / `EntityInfo.collectionHref` — never construct paths from `entity.name`.

- `GET /` → entities root; `cg:entity` links enumerate all collections
- `GET /profile` → profile root; `cg:entity` links enumerate all entity profiles (`name` (singular), `title`, `href` (plural profile URL))
- `GET /profile/{plural}` → HAL-FORMS schema: attributes (`blueprint:attribute`), relations (`blueprint:relation`), search/create templates; each profile's `_links.describes` contains `[{href: "/{plural}", name: "collection"}, {href: "/{plural}/{id}", name: "item", templated: true}]` — use these links to get the actual collection and item URLs
- `GET /{plural}` → HAL collection | `GET /{plural}/{id}` → single item | `GET /{plural}/{id}/{relation}` → related items (to-many: redirects to filtered collection; to-one: returns single entity-item)
- `GET /{plural}/{id}/{attribute}` → binary content (entity-content resource)
- CURIEs: `cg:` (contentgrid), `blueprint:` (schema), `automation:` (automation)
- Content types: `application/hal+json` (data), `application/prs.hal-forms+json` (profile/forms)

### Resource Types

- **entity-item**: Single instance; attributes as top-level JSON fields + `id`. Links: `self`, `cg:relation` (per relation, `name` = relation name), `cg:content` (per content attr, `name` = attribute name)
- **entity-collection**: Ordered set in `_embedded.item`; pagination in `page` object (`total_items_exact`, `total_items_estimate`, cursors)
- **relation** (to-one): GET returns single entity-item (via redirect); PUT `text/uri-list` sets link; DELETE clears it
- **relation** (to-many): GET returns filtered collection (via redirect); POST `text/uri-list` adds; DELETE clears all
- **entity-content**: Binary file; GET/PUT any Content-Type; filename via `Content-Disposition`; supports Range requests
- **entities-root**: Root resource (`/`); `cg:entity` links enumerate all collections
- **profile-root**: `GET /profile`; `cg:entity` links enumerate all profiles

### Entity Profile Schema

Embedded in HAL-FORMS profile response:

- `blueprint:attribute` → `{name, title, type, readOnly, required, constraints:[...], searchParams:{exact-match, prefix-match}}`
- `blueprint:relation` → `{name, title, many_source_per_target, many_target_per_source, required}`; link `blueprint:target-entity` → target profile href
- `blueprint:constraint` → type: `allowed-values` (enum), `required`, `unique`, system-managed (audit timestamps: `created-date`, `created-by`, `modified-date`, `modified-by`)
- `blueprint:search-param` → filter types: `exact-match`, `prefix-match`, `greater-than`, `less-than`, `greater-than-or-equal`, `less-than-or-equal`, `full-text`
- `_templates.search` → search form; `_sort` property has allowed sort values
- `_templates.create-form` → create form; relation fields have type `url` with `options.link.href`

### Pagination & Filtering

- **Cursor-based**: first page uses `size` param; subsequent pages follow HAL `next`/`prev` link `href` directly — never construct cursor URLs manually
- Response `page` object: `{ size, total_items_exact, total_items_estimate }`
- HAL pagination links: `first`, `prev`, `next`, `self` (absent when no more pages) — use `slice.next?.href` / `slice.previous?.href` from `HalSlice`
- Sort: `_sort=attribute,asc|desc`; repeatable for multi-column sort
- Multiple different filters → AND logic; same filter repeated → OR logic
- Unknown parameters are silently ignored
- In app: `cursor` URL param stores the full next/prev href; cleared on search/filter/sort change
- DO NOT parse or modify `_cursor` values; DO NOT store cursors permanently

### HTTP Operations

- **PUT**: Replaces all fields; omitted fields become `null` — use only for full replace
- **PATCH**: Updates only specified fields — prefer for partial updates
- **DELETE**: Entity items, relations, content
- **Conditional requests**: `If-Match`/`If-None-Match` with ETag to prevent concurrent update conflicts (RFC 9110); ETag value includes surrounding quotes
- **Range requests**: Supported on entity-content resources only; check `Accept-Ranges: bytes`; returns 206

### Link Relations

| CURIE         | Full URI                                              | Usage                                                              |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `cg:entity`   | `https://contentgrid.cloud/rels/contentgrid/entity`   | Entity ref from root/profile-root; `name` = entity name (singular) |
| `cg:relation` | `https://contentgrid.cloud/rels/contentgrid/relation` | Relation link on entity-item; `name` = relation name               |
| `cg:content`  | `https://contentgrid.cloud/rels/contentgrid/content`  | Binary content link; `name` = attribute name                       |

Blueprint profile CURIEs (`blueprint:` → `https://contentgrid.cloud/rels/blueprint/{rel}`):

- `blueprint:attribute`, `blueprint:relation`, `blueprint:constraint`, `blueprint:search-param`, `blueprint:target-entity`

CURIE expansion: expand before comparing relation types. Unknown CURIE prefixes cause the link to be ignored.

### HAL-FORMS Templates

Standard template keys on entity-items: `default` (update), `delete`, `set-<relation>` (to-one), `add-<relation>` (to-many), `clear-<relation>`

Standard template keys on entity-profiles: `create-form`, `search`

HAL-FORMS extensions:

- Property names in `application/json` templates use dot-notation paths (e.g., `document.filename`) for nested objects
- `text/uri-list` templates: one URL per line for multi-valued; single URL for to-one
- Remote options (`options.link`): platform retrieves enumerated values from a remote resource; `application/hal+json` uses embedded `item` resources

---

## Libraries

- `@contentgrid/hal` — `HalObject`, `HalSlice` for paginated data
- `@contentgrid/hal/rels` — link relation utilities, `createRelations()`
- `@contentgrid/hal/shapes` — POJO types for raw HAL JSON

---

## API Discovery Pattern

1. Start at the root resource (`/`) — discover all entity collections via `cg:entity` links.
2. Fetch `/profile/<entity>` for generic tooling that must adapt to model changes.
3. Never hardcode collection URLs or entity names in client code.
4. Follow `next`, `prev`, `first` links for pagination — never construct cursor URLs.

---

## Architecture Principles

### API-First

- The REST API is the ONLY interaction point — for users, frontends, and external automations.
- All responses use HAL (`application/hal+json`) for hypermedia linking.

### Model-First

- APIs are generated directly from the data model — never hand-crafted.
- The data API does NOT expose model abstractions — those live in the profile API (`/profile`, `/profile/{entity}`).
- The profile/model API is the correct integration point for generic tooling that needs to adapt to any model.

### Small Core & Extensibility

- Extensions authenticate via OIDC tokens and receive at most user-level privileges — never elevated access.
- Extensions interact exclusively through the standard REST API.

---

## Authentication & Authorization

### Authentication

- All API access requires an OIDC-based Bearer token (RFC 6750); send in `Authorization` header only.
- Tokens are short-lived (default 5 minutes); clients must refresh proactively.
- Use OIDC Discovery (`/.well-known/openid-configuration`) to find token endpoints — never hardcode them.

### Authorization Model (ABAC)

- **Deny by default**: all access denied unless an explicit policy grants it.
- Policies evaluated per entity and per operation (Read, Create, Update, Delete).
- Multiple policies on an entity use **OR** logic; all conditions within a single policy use **AND** logic.
- Empty condition list = unconditional access for that operation.
- The application API does NOT expose permission conditions — not readable via the API.
- Observable effects from the frontend perspective: 403 (or 404 on single-item reads) when the current user lacks permission; collection list queries silently filter out denied items.
- **Special Update behavior**: conditions must be satisfied BOTH before AND after the mutation.

### OPA / Policy Evaluation

- Open Policy Agent (OPA) evaluates Rego policies centrally; partial evaluation returns residual SQL expressions for collection queries.
- Attribute changes take effect immediately on subsequent requests — no cache invalidation needed.

---

## Error Handling (RFC 9457 Problem Types)

All error responses: `Content-Type: application/problem+json`; fields: `type` (URI), `title`, `detail`, `status`, plus problem-specific extras.

Key problem types from `https://contentgrid.cloud/problems/`:

**Validation (400):**

- `input/validation` — `errors[]` array with per-field issues: `required`, `type`, `duplicate`, `allowed-values`, `no-content`, `pattern`, `missing-relation-target`
- `input/validation/duplicate` — check `conflicting_item` URL
- `input/validation/allowed-values` — check `allowed_values[]`
- `input/validation/missing-relation-target` — check `missing_item`

**Query params:**

- `invalid-query-parameter/filter/format`, `invalid-query-parameter/sort/format`, `invalid-query-parameter/pagination`

**Request:**

- `invalid-request/body/single-link` (400) — to-one relation PUT must contain exactly one URI
- `invalid-request/required-header`, `invalid-request/forbidden-header`

**Versioning:**

- `unsatisfied-version` (412) — ETag mismatch; re-fetch, re-apply, retry

**Not found:**

- `not-found/endpoint` (404) — URL/ID not found
- `not-found/entity-item` (404) — entity ID does not exist or access denied (ABAC)
- `not-found/relation-item` (404)

**Integrity:**

- `integrity/blind-relation-overwrite` (409) — unlink existing relation first (`existing_relation`), then set new one
- `integrity/required-relation` (409) — cannot delete entity referenced by a required relation; delete or re-link the referencing entity first

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| 400  | Malformed request body or invalid parameters                    |
| 401  | Missing or invalid Bearer token                                 |
| 403  | Authenticated but forbidden                                     |
| 404  | Resource not found OR access denied to a specific entity (ABAC) |
| 409  | Unique constraint violation or referential integrity conflict   |
| 412  | ETag mismatch (optimistic locking failure)                      |
| 415  | Unsupported Content-Type                                        |

---

## Navigator (Generic Frontend)

- Adapts dynamically to any ContentGrid application's data model via HAL discovery — no application-specific code.
- Discovers entities and operations by following `cg:entity` links from the root resource.
- Renders forms using `_templates` (HAL-FORMS) without hardcoded field knowledge.

Supported preview formats: PDF, JPEG, PNG, DOC/DOCX, PPT/PPTX, XLS/XLSX, ODT, ODS, ODP.

Entity creation conventions:

- Mandatory fields indicated with `*` in the create form.
- Content fields support drag-and-drop upload.
- Relation fields use a popover search to find and link existing entities.
- To create a missing relation target inline: use the "create" button in the relation popover — opens in a new tab.

---

## Webhooks & Event Integration

Event types: `create`, `update`, `content`, `delete`.

Delivery: HTTP POST; body `application/json`; asynchronous; delivered individually per event.

Key headers: `ContentGrid-Signature` (RS256-signed JWT), `ContentGrid-Application-Id`, `ContentGrid-Deployment-Id`.

Signature verification: RS256; public keys at `GET ${CONTENTGRID_URL}/.well-known/jwks.json`; keys rotate — use `kid` from JWT header; always use a JWT library.

---

## Data Storage Model

- **Metadata**: Each Entity → one PostgreSQL table; each Attribute → one column. Schema generated/migrated automatically.
- **Content**: Binary files in isolated per-application S3 buckets; database holds references only; objects immutable (updates create new objects).
- **Encryption**: AES-128 CTR mode, transparent to clients. One DEK per content object; CTR mode enables Range requests.

---

## Runtime Platform Components

| Component              | Role                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Gateway**            | Entry point; domain routing, JWT validation, CORS, OPA query, residual encoding          |
| **Keycloak**           | OIDC provider; issues JWTs with embedded user attributes                                 |
| **OPA**                | Centralized ABAC policy engine; partial evaluation → SQL residuals                       |
| **Solon**              | Collects Rego policies from all applications; maintains OPA policy bundle                |
| **Navigator**          | Generic React frontend; adapts to any model via HAL/HAL-FORMS discovery                  |
| **Liaison**            | Delivers Navigator config (OIDC client ID, issuer) per application domain                |
| **Pathfinder**         | Auto-creates Kubernetes Ingress + TLS for applications                                   |
| **RabbitMQ**           | Message broker for entity lifecycle events                                               |
| **Slingshot**          | Webhook delivery; RS256-signed payloads; dead-letter on exhausted retries                |
| **TokenMonger**        | Token exchange for extensions                                                            |
| **Application Server** | Configuration-driven; single image serves all apps; REST layer generated from model JSON |

---

## Management Platform Pipeline

- **Architect**: Source of truth for application models; full version history.
- **Scribe**: Compiles a model into a deployable artifact ZIP (model JSON, Flyway SQL migrations, Rego policies, OpenAPI spec, manifest). Deterministic: same model + same Scribe version = identical artifact.
- **Captain**: Orchestrates infrastructure (PostgreSQL, S3, Keycloak realm) and Kubernetes resources.

---

## Naming & URL Conventions

- Entity collection URLs use the plural form from the profile `href` — NOT derived by appending `s` to `entity.name`.
- Relation names appear as path segments after the entity item URL.
- Attribute names appear as path segments for content attributes.
- CURIE prefix `cg:` → `https://contentgrid.cloud/rels/contentgrid/`
- CURIE prefix `blueprint:` → `https://contentgrid.cloud/rels/blueprint/`
- Problem type URIs base: `https://contentgrid.cloud/problems/`
- JWKS endpoint: `${CONTENTGRID_URL}/.well-known/jwks.json`
- Token endpoint: discovered via OIDC Discovery, never hardcoded.

---

## Integration Checklist

- Always start API exploration from the root (`/`) — follow `cg:entity` links.
- Use the entity profile (`/profile/<entity>`) for generic tooling that must adapt to model changes.
- Prefer PATCH over PUT for partial updates.
- Always include and validate ETags for mutable operations.
- Never construct or parse pagination cursors — follow HAL `next`/`prev` links directly.
- Send Bearer tokens in the `Authorization` header only.
- Verify webhook signatures using the JWKS endpoint and a JWT library.
- Extensions (external services/automations built on top of a ContentGrid application — see "Small Core & Extensibility") must authenticate via OIDC and use the same REST API as any other client.
- **Drive mutations from `_templates`**: read `method`, `target`, and `contentType` from the item's `default`/`delete`/`set-<rel>`/`add-<rel>`/`clear-<rel>` template or the profile's `create-form` template. Never hardcode HTTP method, URL, or Content-Type in a mutation hook.
- **Gate operations on template/link presence**: absence of `_templates.delete` (or any other template) means that operation is not permitted for this item/user. Do NOT render or invoke an operation whose template is absent.
- **Never derive URLs from path conventions**: collection URLs come from `cg:entity` links; item URLs from expanding the profile's templated `describes` link; relation/content URLs from `cg:relation`/`cg:content` links on the entity item. Do NOT string-build or regex-replace any URL.
- **IDs from the `id` field only**: never parse an entity ID out of a self href.
- **No hardcoded attribute names**: at the API/profile level, a content attribute has `blueprint:attribute type: "content"`. In `@contentgrid/navigator-data`, use `attr.isContent` on a `ProfileAttribute` — the `ProfileAttributeType` TypeScript enum has no `content` member (content is represented as `type === "object"` with embedded child attributes). Discover audit-role fields via `blueprint:constraint` system-managed types (`created-date`, `created-by`, `modified-date`, `modified-by`). Attribute names are customer-defined and not stable.
- **Search operations** must be executed through the `_templates.search` template on the entity profile (`/profile/{plural}`, via `profileEntity.searchTemplate`) — never by hand-building query URLs. See the search template guide in [`packages/navigator-data/CLAUDE.md`](packages/navigator-data/CLAUDE.md).
- For the full data-layer rules see [`packages/navigator-data/CLAUDE.md`](packages/navigator-data/CLAUDE.md).
