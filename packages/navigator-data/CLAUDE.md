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

## Dependency capability map

These are the Layer-1 packages (see ADR-007 and the peerDep rule above) — use what they expose; do not re-implement it.

| Package                                      | Concern it owns                             | Key exports                                                                                                                                                                                                     | Check before hand-rolling   |
| -------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `@contentgrid/hal`                           | HAL parsing & link resolution               | `HalObject` (incl. `.self`), `HalSlice`, `HalEmbedded`, `HalError`, `Link`, `SimpleLink`, `Links` (`findLink`, `findLinks`, `requireSingleLink`)                                                                | `build/index.d.ts`          |
| `@contentgrid/hal` `/rels`                   | Link-relation helpers                       | `createRelations`, `createRelation`, `ianaRelations`, `LinkRelation` type                                                                                                                                       | `build/rels/index.d.ts`     |
| `@contentgrid/hal` `/shape`                  | POJO shape types                            | `HalObjectShape`, `LinkShape`, `LinksShape`, `HalEmbeddedShape`, `HalSliceShape`                                                                                                                                | `build/shape/index.d.ts`    |
| `@contentgrid/hal` `/curies`                 | CURIE registry                              | `Curie`, `CurieRegistry`                                                                                                                                                                                        | `build/curies/index.d.ts`   |
| `@contentgrid/hal-forms`                     | HAL-FORMS template resolution & errors      | `resolveTemplate`, `resolveTemplateRequired`, `HalFormsTemplate`, `HalFormsProperty` (incl. `multiValue`, `options.isInline()`, `options.isRemote()`), `HalTemplateNotFoundError`, `InvalidHalFormsOptionError` | `build/index.d.ts`          |
| `@contentgrid/hal-forms` `/values`           | Immutable form value manager                | `createValues`, `HalFormValues` (`withValue`, `withoutValue`, `withValues`, `valueMap`)                                                                                                                         | `build/values/index.d.ts`   |
| `@contentgrid/hal-forms` `/codecs`           | Request body encoding                       | default `HalFormsCodecs`, `Coders` namespace                                                                                                                                                                    | `build/codecs/index.d.ts`   |
| `@contentgrid/hal-forms` `/shape`            | Shape types for templates                   | `HalFormsTemplateShape`, `HalFormsPropertyShape`, `HalFormsPropertyType`                                                                                                                                        | `build/shape.d.ts`          |
| `@contentgrid/typed-fetch`                   | Phantom-typed fetch client & requests       | `createTypedFetch`, `createRequest`, `Representation.json`, `TypedRequestSpec`, `TypedRequest`, `TypedResponse`                                                                                                 | `build/index.d.ts`          |
| `@contentgrid/fetch-hooks`                   | Composable request hooks                    | `createHook` (default), `compose`, `FetchHooksError`, `UsageError`                                                                                                                                              | `build/index.d.ts`          |
| `@contentgrid/fetch-hooks` `/request`        | Header mutation hooks                       | `setHeader`, `appendHeader`                                                                                                                                                                                     | `build/request.d.ts`        |
| `@contentgrid/fetch-hooks` `/value-provider` | Value resolution                            | `ValueProvider` type, `ValueProviderResolver` (namespace: `constant`, `cached`, `fn`, `fromValueProvider`)                                                                                                      | `build/value-provider.d.ts` |
| `@contentgrid/fetch-hook-authentication`     | OIDC bearer auth hook                       | `createBearerAuthenticationHook` (default), `AuthenticationTokenSupplier`, `AuthenticationToken`, `createCompositeTokenSupplier`, `createContentgridTokenExchangeTokenSupplier`                                 | `build/index.d.ts`          |
| `@contentgrid/problem-details`               | `application/problem+json` parsing & errors | `checkResponse`, `fromResponse`, `ProblemDetailError`, `ProblemDetail`                                                                                                                                          | `build/index.d.ts`          |
| `@contentgrid/uri-template`                  | URI Template expand / match                 | `UriTemplate` (default — `expand`, `match`, `variables`, `template`)                                                                                                                                            | `build/index.d.ts`          |

> Map tracks the `0.4.x` line (all seven pinned at `0.4.2`, range `^0.4.0`).

---

## HAL hook conventions

Hooks in this package wrap TanStack Query. Follow these conventions:

**Hook naming:**

All hooks are **generic** — they accept an accessor instance (e.g. `profileEntity`) as a parameter
rather than being specialised to a single entity type. The noun suffix reflects the accessor, not an
entity name like `invoice`.

- Collection queries: `useEntityItemCollection`, `useEntityItemCollectionInfiniteScroll`
- Single-item queries: `useEntityItem`
- Profile queries: `useProfileEntity`, `useProfileEntities`
- Mutations — create: `useCreateEntityItem`, update: `useUpdateEntityItem` _(not yet implemented)_,
  delete: `useDeleteEntityItem` _(not yet implemented)_
- Derived / convenience: `useRecentlyCreated`, `useRecentlyModified`

`useEntityItem` supports two modes — choose based on what you know at call time:

- **Known profile** `{ profileEntity, entityId }` — use when the profile is already in scope.
  The item URL is expanded from `profileEntity.itemUrl(entityId)` (URI template; no string concatenation).
  Query is disabled when `entityId` is `undefined`.
- **Discover profile** `{ url }` — use when only the full item URL is known (e.g. from a relation link).
  The hook calls `profile.describes(SimpleLink.to(url))` against every loaded profile to find the match.
  Query is disabled until the matching profile is available.

Both modes always call `useProfileEntities()` (Rules of Hooks). Results are cached so there is no extra
network cost in known-profile mode.

**Accessor and static factory naming:**

Accessor classes wrap a parsed HAL resource and co-locate their TanStack Query factories:

| Class                   | Wraps                                       | Static query factory                                                                           |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ProfileEntity`         | `/profile/{plural}` HAL-FORMS profile       | `profileByLinkQuery(apiFetch, link)`                                                           |
| `ProfileAttribute`      | `blueprint:attribute` embedded resource     | —                                                                                              |
| `ProfileRelation`       | `blueprint:relation` embedded resource      | —                                                                                              |
| `SearchHalFormTemplate` | `_templates.search` HAL-FORMS template      | —                                                                                              |
| `CreateHalFormTemplate` | `_templates.create-form` HAL-FORMS template | —                                                                                              |
| `EntityItem`            | `/{plural}/{id}` HAL entity-item resource   | `fetchByUrlQuery(apiFetch, url, profileEntity)`                                                |
| `EntityItemCollection`  | `/{plural}` HAL entity-collection resource  | `fetchByUrlQuery(apiFetch, url, profileEntity)`, `infiniteQuery(apiFetch, url, profileEntity)` |

Standalone query factories (system-level, not tied to one entity):

- `profileRootQuery(apiFetch, profileUrl)` — query options for `/profile`

**Request builder naming:**

Methods that encode HAL-FORMS values into a `Request` object follow the pattern
`<verb><Resource>Request`. They do **not** call `apiFetch` — that happens in the hook or query function.

- `profileEntity.searchEntityRequest(values)` → `Request` for `_templates.search`
- `profileEntity.createEntityItemRequest(values)` → `Request` for `_templates.create-form`
- `entityItem.editEntityRequest(values)` → `Request` for `_templates.default`

**URL construction — never concatenate by hand:**

- `profileEntity.collectionUrl` — the entity collection URL (e.g. `/invoices`); read directly from the `describes` collection link.
- `profileEntity.itemUrl(entityId)` — expands the item URI template (e.g. `/{plural}/{id}`) via `@contentgrid/uri-template`.
- Follow HAL `next`/`prev`/`self` links directly for pagination — never construct cursor URLs.

**Return shape:**

- Queries return the standard TanStack Query result shape:
  `{ data, isLoading, isError, error, refetch }`.
- `data` for collection hooks is `EntityItemCollection` (wraps a `HalSlice`).
- `data` for item hooks is `EntityItem` (wraps a `HalObject`).
- Do NOT unwrap or reshape inside the hook — leave that to the consumer.

**Rules-of-Hooks safety — multi-mode hooks call the TanStack hook exactly once:**

`useEntityItemCollection`, `useEntityItemCollectionInfiniteScroll`, and `useEntityItem` accept
several parameter shapes (by-url / default / by-search; known-profile / discover-profile). They
MUST resolve those shapes into plain values first, then call the underlying TanStack hook once,
unconditionally. NEVER branch into separate `return useQuery(...)` arms — calling a hook inside an
`if` / early `return` changes hook order between renders (a Rules-of-Hooks violation; React and
SonarCloud both flag "React Hook is called conditionally").

- Collection hooks resolve params via the hookless helper `resolveCollectionRequest(params) →
{ url, enabled }`, then make a single `useQuery` / `useInfiniteQuery` call passing `enabled`.
  Add new param modes inside that helper — never as a new hook-call site.
- Disable a query with `enabled: false`, never by skipping the hook call. Disabled when:
  `searchValues === undefined` (search mode), `entityId === undefined` (`useEntityItem` known
  mode), or the required link/profile is not yet resolved.
- `useEntityItem` calls `useProfileEntities()` first (both modes — cached), resolves `url` and
  `profileEntity` in plain code, then makes one `useQuery` (`enabled: !!url && !!profileEntity`).
- `useProfileEntity` must NOT pass an unresolved link to `ProfileEntity.profileByLinkQuery`
  (computing a queryKey from `undefined` throws). Until the `cg:entity` link is found, pass a
  placeholder `queryKey` + `enabled: false`.
- `useProfileEntities` fans out over the profile-root `cg:entity` links with `useQueries` and
  returns the per-entity result array via `combine`; consumers read each result's own state.

**Query-options factories, retry, and placeholder data:**

- Factories (`fetchByUrlQuery`, `infiniteQuery`, `profileByLinkQuery`, `profileRootQuery`) return
  TanStack `queryOptions` / `infiniteQueryOptions`. The hook spreads them and may add `enabled`.
  Never call `apiFetch` outside the `queryFn`.
- Retry belongs to the `QueryClient` (production: default of 3; tests: `retry: false` via
  `makeQueryClient`). Prefer NOT to bake `retry` into a factory — a baked-in value overrides the
  QueryClient and makes error paths untestable without fake timers. `profileRootQuery` omits it on
  purpose; `fetchByUrlQuery`, `infiniteQuery`, and `profileByLinkQuery` still hardcode `retry: 3`,
  so when testing THEIR error paths advance fake timers (`vi.useFakeTimers()` +
  `vi.runAllTimersAsync()`) to flush backoff.
- Collection queries use `placeholderData: keepPreviousData` for smooth page-to-page transitions.
  In tests assert on `isSuccess` / `isError`, not just `!!data` — placeholder data can be present
  transiently before the real result resolves.

---

## Search request example

Always build search values from the profile's search template — never construct URLs or property names manually.

```typescript
import { createValues } from "@contentgrid/hal-forms/values";
import { ProfileAttributeSearchType } from "@contentgrid/navigator-data";

// 1. Load the profile (cached; cheap to call)
const { data: profile } = useProfileEntity({ name: "invoice" });

const searchTemplate = profile?.searchTemplate;

// 2. Discover available search properties from the template — never hardcode names.
//    Example: find the first prefix-match property and apply a filter value.
const prefixProperty = searchTemplate?.getSearchPropertiesByType(
  ProfileAttributeSearchType.prefixMatch,
)[0];

// 3. Discover available sort options from the template — never hardcode sort strings.
//    Example: pick the first descending sort option.
const sortOption = searchTemplate?.sortOptions?.find((opt) => opt.direction === "desc");

// 4. Build search values, setting only the fields we have values for.
const searchValues =
  searchTemplate && prefixProperty && sortOption
    ? createValues(searchTemplate.template)
        .withValue(prefixProperty.property.name, "ABC")
        .withValue(searchTemplate.sortProperty!.name, [sortOption.value])
    : undefined;

// 5. Pass to the collection hook — undefined disables the query.
const { data: collection } = useEntityItemCollection({
  profileEntity: profile!,
  searchValues,
});
```

**Rules:**

- Use `searchTemplate.searchProperties` / `getSearchPropertiesByType()` to find filter fields — do not hardcode property names.
- Use `searchTemplate.sortOptions` to find sort values — do not construct sort strings like `"field,asc"` by hand.
- `_sort` is always multi-value: pass `[sortOption.value]` (an array), never a plain string.
- `searchValues = undefined` disables the query (no fetch). Intentional when prerequisites are missing.

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

These rules prevent the systemic deviations identified in an earlier HAL-FORMS audit.
The current codebase encapsulates most of the correct behaviour in the accessor layer — the
rules below explain where and why.

**1. Drive mutations from `_templates` — never hardcode method, target, or Content-Type.**

Templates: `default` (update), `delete`, `set-<relation>` (to-one),
`add-<relation>`/`clear-<relation>` (to-many), `create-form` (profile-level create).

Where to find this now:

- `entityItem.defaultTemplate` — the update template; `null` when not permitted (see rule 2).
- `profileEntity.createTemplate` — the create template; `null` when not permitted.
- `entityItem.editEntityRequest(values)` and `profileEntity.createEntityItemRequest(values)`
  already encode via `halFormCodecs` internally — do not re-implement encoding in a hook or feature.
- Build values with `createValues(template)` (re-exported from `@contentgrid/navigator-data`);
  values are immutable — update with `.withValue(name, val)` / `.withoutValue(name)`.

**2. Gate every operation on template/link presence — never assume permission.**

Template absence is the platform's per-item ABAC signal. Rendering or invoking an operation
whose template is absent bypasses permission boundaries silently.

Rules:

- `entityItem.defaultTemplate !== null` → update is permitted.
- `profileEntity.createTemplate !== null` → create is permitted.
- Expose capability as a named boolean (`canUpdate`, `canCreate`, …) derived from template
  presence. Feature components must read the flag — not re-check raw templates.

**3. URLs only from links — never string-built.**

| What you need      | How to get it — current API                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Collection URL     | `profileEntity.collectionUrl` (from the `describes` collection link)                            |
| Item URL           | `profileEntity.itemUrl(entityId)` (URI-template expansion via `@contentgrid/uri-template`)      |
| Content URL        | `entityItem.contentLinks` / `entityItem.halItem.links.findLink(cgRels.content, attrName)?.href` |
| Next/prev page URL | `EntityItemCollection.nextHref` / `prevHref` from the HAL slice                                 |

Do NOT derive URLs via string transforms such as `href.replace(/\/profile\//, "/")`,
`${collectionHref}/${id}`, `${itemHref}/${relationName}`, or `.split("/").pop()`.

**4. IDs from the `id` field — never parsed from hrefs.**

Read `item.id`. Do NOT call `selfHref.split("/").pop()` or any
href-parsing idiom. URL structure is an implementation detail the server can change.

**5. Carry full template property metadata through the FieldDescriptor bridge.**

The HAL-Forms → `FieldDescriptor[]` bridge MUST propagate all of:

- `options.inline` and `options.link` (remote enumerations) — dropping `options.link`
  silently removes remote-option fields from forms.
- All validation constraints: `required`, `regex`, `readOnly`, `allowed-values`.

Do NOT narrow the bridge output to a lossy subset of the template shape.

**6. No hardcoded attribute names — discover roles via profile constraints.**

- Content attributes: check `attr.type === ProfileAttributeType.content` (from the entity
  profile). Do NOT probe for sub-field names like `filename`, `mimetype`, or `length`.
- Audit fields: use `profileEntity.auditAttributes` and `profileEntity.userDefinedAttributes`
  which are already classified by constraint type (`created-date`, `created-by`,
  `modified-date`, `modified-by`). Do NOT key logic to literal names like `created_date`.
- Attribute names are customer-defined; only the constraint type is stable across applications.

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
