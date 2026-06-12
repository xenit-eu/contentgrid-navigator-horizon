# packages/navigator-data — CLAUDE.md

Package: `@contentgrid/navigator-data`
Purpose: Navigator-side HAL data access layer. Composes the seven
`@contentgrid/*` core packages (Layer 1) into TanStack Query hooks, an
ETag/`If-Match` policy, the HAL-Forms → `FieldDescriptor[]` bridge, Zod-
validated app config, and MSW handler fixtures. This is Layer 2 of the
two-layer dependency model.

Platform-wide conventions (HAL structure, HTTP semantics, error types):
see root [`CLAUDE.md`](../../CLAUDE.md).
Dependency model rationale: [ADR-007](../../docs/adr/ADR-007-two-layer-dependency-model.md).

---

## peerDependency policy

([ADR-007](../../docs/adr/ADR-007-two-layer-dependency-model.md))

All seven `@contentgrid/*` Layer-1 packages are `peerDependencies`:

```
@contentgrid/hal                   ^0.4.0
@contentgrid/hal-forms             ^0.4.0
@contentgrid/typed-fetch           ^0.4.0
@contentgrid/fetch-hooks           ^0.4.0
@contentgrid/fetch-hook-authentication ^0.4.0
@contentgrid/problem-details       ^0.4.0
@contentgrid/uri-template          ^0.4.0
```

Rule: do NOT move these to `dependencies`. Do NOT re-implement anything
they provide.

Why: `peerDependencies` keeps Xenit as the single source of truth. Re-vendoring
or re-implementing Layer-1 functionality creates a fork — backend changes would
land twice. Declaring as `peerDeps` also prevents duplicate React/TanStack
instances in consumer bundles.

TanStack Query and React are also `peerDependencies` for the same deduplication
reason — only one instance of each must exist at runtime.

---

## HAL hook conventions

Hooks in this package wrap TanStack Query. Follow these conventions:

**Naming:**

- Collection queries: `useList<EntityName>` (e.g. `useListEntities`)
- Single-item queries: `useEntity` (generic, entity type via type param)
- Mutations — create: `useCreate<EntityName>`, update: `useUpdate<EntityName>`,
  delete: `useDelete<EntityName>`
- Relation queries: `useRelation` (generic, relation name via param)
- Search: `useSearch<EntityName>`

**Return shape:**

- Queries return the standard TanStack Query result shape:
  `{ data, isLoading, isError, error, refetch }`.
- `data` for collection hooks is `HalSlice` from `@contentgrid/hal`.
- `data` for item hooks is `HalObject` from `@contentgrid/hal`.
- Do NOT unwrap or reshape the HAL object inside the hook — leave that
  to the consumer (pattern component or feature).

**Error handling:**

- Use `@contentgrid/problem-details` to parse `application/problem+json`
  responses. Do NOT manually inspect `response.status` for domain logic.
- Surface the parsed problem detail via TanStack Query's `error` field.
- 412 (ETag mismatch) must be handled at the call site: re-fetch, re-apply,
  retry. The hook must not swallow or auto-retry 412.

**HAL contract tests (ADR-014):**

- MSW handler fixtures live alongside hooks in this package and are exported
  for consumer reuse.
- When adding or changing a hook, update the corresponding MSW fixture so
  contract tests catch shape drift.
- See [ADR-014](../../docs/adr/ADR-014-hal-contract-tests-msw.md).

---

## HAL-FORMS affordance rules

These rules prevent the four systemic deviations identified in the HAL-FORMS audit.
The companion code fixes live in the `halforms/*` PRs.

**1. Drive mutations from `_templates` — never hardcode.**

- Read `method`, `target`, and `contentType` from the template, not from
  constants in the hook. Templates: `default` (update), `delete`,
  `set-<relation>` (to-one), `add-<relation>`/`clear-<relation>` (to-many),
  `create-form` (profile-level create).
- Do NOT hardcode `PATCH`, `POST`, `DELETE`, `PUT`, or a `Content-Type` string
  in a mutation hook. The platform can change affordances per item/user; the
  template is the contract.

**2. Gate every operation on template/link presence — expose capability flags.**

- Absence of `_templates.delete` means delete is not permitted for this
  item/user (ABAC). Do NOT render or invoke an operation whose template is
  absent.
- Expose `canUpdate`, `canDelete`, `canCreate`, `canSetRelation`, etc. as
  derived booleans from template/link presence. Consumers must not re-check
  raw templates; they read the flag.
- Why: template absence is the platform's per-item ABAC signal. Bypassing it
  silently hides permission boundaries.

**3. URLs only from links — never string-built.**

- Collection URLs: follow `cg:entity` links from the root resource (`/`).
  Do NOT derive them via `href.replace(/\/profile\//, "/")` or any string
  transform.
- Item URLs: expand the profile's `_links.describes` templated item link
  (`name: "item"`). Do NOT construct `${collectionHref}/${id}`.
- Relation URLs: follow `cg:relation` links (by `name`) on the entity item.
  Do NOT concatenate `${itemHref}/${relationName}`.
- Content URLs: follow `cg:content` links (by `name`) on the entity item.
  Do NOT concatenate `${itemHref}/${attributeName}`.
- Pagination: follow `next`/`prev` link `href` directly from the HAL response.
  Do NOT construct cursor URLs.
- Why: HAL URLs are server-controlled. Any string transform breaks on
  non-trivial path structures and bypasses future versioning.

**4. IDs from the `id` field — never parsed from hrefs.**

- Read the `id` field from the response body. Do NOT call
  `selfHref.split("/").pop()` or any href-parsing idiom.
- Why: URL structure is an implementation detail. Parsing it couples the
  client to a path convention the server can change.

**5. Carry full template property metadata through the FieldDescriptor bridge.**

- The HAL-Forms → `FieldDescriptor[]` bridge MUST propagate:
  - `options.inline` AND `options.link` (remote enumerations). Dropping
    `options.link` silently removes remote-option fields from forms.
  - All validation constraints: `required`, `regex`, `readOnly`,
    `allowed-values`. Each maps to a `FieldDescriptor` field; omitting any
    is a contract violation.
- Do NOT narrow the bridge output to a lossy subset of the template shape.
- Why: downstream renderers rely on the full metadata to produce correct,
  accessible forms. Any dropped field degrades UX silently.

**6. No hardcoded attribute names — discover roles via profile constraints.**

- Do NOT detect content attributes by probing for sub-attribute names like
  `filename`, `mimetype`, or `length`. Use the `blueprint:attribute` `type:
  "content"` field from the entity profile.
- Do NOT key audit-field logic to literal names (`created_date`, `created_by`,
  `last_modified_date`, `last_modified_by`). Discover audit-role fields via
  the `blueprint:constraint` system-managed types: `created-date`,
  `created-by`, `modified-date`, `modified-by`.
- Why: attribute names are customer-defined; only the constraint type is
  stable across applications.

---

## ETag / conditional-request pattern

The platform uses ETags for optimistic concurrency (RFC 9110).
Problem type for mismatch: `unsatisfied-version` (HTTP 412).

Canonical flow:

1. **GET** `/{plural}/{id}` — capture the `ETag` response header.
   Store the ETag value exactly as received (including surrounding quotes).
2. **PUT or PATCH** `/{plural}/{id}` — send `If-Match: <stored-ETag>`.
3. **On 412** — the item was modified concurrently. Re-fetch to get the
   current state + new ETag, re-apply the user's changes, and retry.

Rules:

- Always send `If-Match` on mutating requests for entity items.
- Do NOT strip or modify the ETag value — the platform compares verbatim.
- Do NOT store ETags permanently (session state only).
- Do NOT parse or construct ETag values — treat them as opaque strings.

---

## What belongs here vs. elsewhere

Belongs here:

- TanStack Query hooks for HAL resources.
- ETag / `If-Match` policy implementation.
- HAL-Forms → `FieldDescriptor[]` bridge (ADR-004).
- Zod-validated app config + presets.
- MSW handler fixtures (exported for consumers).

Does NOT belong here:

- UI components — those go in `packages/ui`.
- Feature-specific business logic — that goes in `packages/features/<name>/`.
- Re-implementations of anything in `@contentgrid/hal`, `@contentgrid/hal-forms`,
  or the other Layer-1 packages.

---

## Forbidden imports

- Do NOT import from `packages/ui` (`@contentgrid/ui`). This is the data
  layer — it has no UI knowledge.
- Do NOT import from `apps/*`. This is a shared package.
- Do NOT import from `packages/features/*`. Features depend on
  `navigator-data`, not the other way around.
