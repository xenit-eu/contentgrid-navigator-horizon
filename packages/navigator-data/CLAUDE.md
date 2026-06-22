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

- All non-2xx responses throw `ProblemDetailError` (`src/api/errors.ts`). Read the RFC 9457 detail
  via `error.problemDetail` (`{ type, title, detail, status, ... }`). Do NOT manually inspect raw
  `response.status`.
- Surface the parsed problem detail via TanStack Query's `error` field.
- 412 (ETag mismatch) must be handled at the call site: re-fetch, re-apply, retry. The hook must
  not swallow or auto-retry 412. Detect via `error instanceof ProblemDetailError &&
error.problemDetail.status === 412`. `PreconditionFailedError` is exported but never thrown in
  the current codebase — do not depend on it.

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

**What exists vs. what is planned:**

The request-spec types, `editEntityRequest` accessor, and MSW handler factories for
update/delete/relation are already in the codebase. The corresponding mutation _hooks_ are not yet
implemented. When building them, mirror the accessors below (all resolved from the item's
`_templates`):

| Operation            | Template key  | Planned hook          | Accessor to add to `EntityItem`                                |
| -------------------- | ------------- | --------------------- | -------------------------------------------------------------- |
| Update               | `default`     | `useUpdateEntityItem` | _already has_ `defaultTemplate` + `editEntityRequest`          |
| Delete               | `delete`      | `useDeleteEntityItem` | `deleteTemplate` + `deleteEntityRequest()` (no values)         |
| Set to-one relation  | `set-<rel>`   | `useRelationMutation` | `setRelationTemplate(name)` + `setRelationRequest(name, uris)` |
| Add to-many relation | `add-<rel>`   | `useRelationMutation` | `addRelationTemplate(name)` + `addRelationRequest(name, uris)` |
| Clear relation       | `clear-<rel>` | `useRelationMutation` | `clearRelationTemplate(name)` + `clearRelationRequest(name)`   |

Binary content (PUT to `cg:content`) has no HAL-FORMS template — see the **Content exception**
section below.

`EntityItem` currently ends with `//TODO support relations` — relation accessor additions go there.

**2. Gate every operation on template/link presence — never assume permission.**

Template absence is the platform's per-item ABAC signal. Rendering or invoking an operation
whose template is absent bypasses permission boundaries silently.

Rules:

- `entityItem.defaultTemplate !== null` → update is permitted.
- `profileEntity.createTemplate !== null` → create is permitted.
- Expose capability as a named boolean (`canUpdate`, `canCreate`, …) derived from template
  presence. Feature components must read the flag — not re-check raw templates.

> **NOTE — not yet implemented:** `canUpdate`, `canCreate`, `canDelete`, and equivalent named
> booleans do NOT yet exist as accessors. Today callers check the raw template directly:
> `entityItem.defaultTemplate !== null` (update), `profileEntity.createTemplate !== null`
> (create). The named-boolean convention is the target pattern once those getters are added to
> the accessor classes.

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

- Content attributes: use `attr.isContent` on a `ProfileAttribute` instance. Do NOT check
  `attr.type === ProfileAttributeType.content` — `ProfileAttributeType` has no `content` member
  (the enum is `string | long | double | boolean | date | datetime | object`). `isContent` is
  true when `type === object` **and** the attribute has embedded `blueprint:attribute` children
  (`attribute-profile.ts:74-79`). Do NOT probe for sub-field names like `filename`, `mimetype`,
  or `length`.
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

**Fetch helpers and ETag capture (`src/api/hal-client.ts`):**

| Helper           | Returns                       | Calls `response.json()` | Use when                                                                                               |
| ---------------- | ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `fetchHal`       | `{ object: HalObject, etag }` | yes                     | GET — need the ETag for subsequent mutations                                                           |
| `fetchHalObject` | `HalObject` (no ETag)         | yes                     | POST that returns 201 + body (create); not exported from `api/index.ts` — import from `api/hal-client` |
| `fetchHalSlice`  | `HalSlice` (no ETag)          | yes (via `fetchHal`)    | Collection queries                                                                                     |

Both `fetchHal` and `fetchHalObject` call `response.json()` and will **throw on a 204 No Content
response** (empty body). Mutations that return 204 — DELETE, relation set/add/clear, content PUT —
need a separate 204-safe path. No such helper exists yet; add `fetchVoid(apiFetch, request)`
(calls `checkResponse`, discards body) when building those hooks.

**Attaching `If-Match` to a mutation request:**

Request builders (`editEntityRequest`, etc.) return a bare `Request` with no conditional header.
The hook attaches it before calling `apiFetch`:

```typescript
// attach If-Match only when an ETag is available
const req =
  etag !== null
    ? new Request(baseReq, {
        headers: { ...Object.fromEntries(baseReq.headers), "If-Match": etag },
      })
    : baseReq;
const { object, etag: newEtag } = await fetchHal<EntityItemShape>(apiFetch, req);
```

Send the stored ETag verbatim — quotes included. Skip the header only when `etag === null`
(e.g. immediately after a create, before the first GET of that item).

**Error class for 412:**

All non-2xx responses surface as `ProblemDetailError` (`src/api/errors.ts`). Check status via
`error.problemDetail.status === 412`. `PreconditionFailedError` is exported from this package but
is **never thrown** anywhere in the current source — do not add a `catch (e instanceof
PreconditionFailedError)` branch; catch `ProblemDetailError` and inspect `.problemDetail.status`.

---

## Mutation hook authoring recipe

Use `useCreateEntityItem` (`src/hooks/use-create-entity.ts`) as the canonical reference. Generalized pattern for any entity-item mutation:

**Options interface:**

```typescript
export interface UseXxxOptions {
  readonly mutationOptions?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">;
}
```

**Hook body:**

```typescript
export function useXxx(/* accessor(s) */, options?: UseXxxOptions) {
  const { apiFetch } = useNavigatorData();   // apiFetch only — no contentFetch in context yet
  const queryClient = useQueryClient();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (values) => {
      // 1. Build Request from accessor (template-driven, never hardcode)
      const baseReq = entityItem.editEntityRequest(values);

      // 2. Attach If-Match when etag is available (send verbatim, quotes included)
      const req =
        entityItem.etag !== null
          ? new Request(baseReq, {
              headers: { ...Object.fromEntries(baseReq.headers), "If-Match": entityItem.etag },
            })
          : baseReq;

      // 3a. Response has a body (create / update) — use fetchHal to capture new ETag
      const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, req);
      return new EntityItem(object, profileEntity, etag);

      // 3b. 204 No Content (delete / relation / content) — use fetchVoid (not yet implemented;
      //     add it to hal-client.ts when building these hooks)
      // await fetchVoid(apiFetch, req);
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      const { href } = item.selfLink;

      // 4. Populate the item cache with the fresh value + new ETag
      queryClient.setQueryData(
        queryKeys.entityItem.byUrl(profileEntity, href),
        item,
      );

      // 5. Invalidate collections so lists reflect the change
      //    Collection key string is "EntitySearch" (query-keys.ts:5)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });

      // 6. Compose caller's onSuccess LAST
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
```

**Key invariants:**

- `useNavigatorData()` provides `apiFetch` only — `contentFetch` does not exist in the context yet (see Content exception below).
- `onSuccess` composition order: cache → invalidate → caller. Never fire caller `onSuccess` before cache is consistent.
- 412 must bubble to the caller (`onError`); the hook must not auto-retry.
  Check `error instanceof ProblemDetailError && error.problemDetail.status === 412`.
- Tests: use `makeQueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })` + `makeWrapper` + MSW handler factories. Extend `contract.test.ts` (ADR-014).

---

## Content exception

Binary content operations (PUT/GET to `cg:content` links) have **no HAL-FORMS template or codec**.
They are the one case where a `Request` is constructed by hand:

- The presence of the `cg:content` link is the ABAC gate — if the link is absent, the operation is
  not permitted. Check `entityItem.contentLinks` or `entityItem.halItem.links.findLink(cgRels.content, attrName)`.
- Build the `Request` directly: `new Request(link.href, { method: "PUT", body: file, headers: { "Content-Type": mimeType } })`.
- Use a **binary client** (`createContentClient`) that omits the `Accept: application/hal+json`
  header set by `createApiClient`. `createContentClient` is already exported from `src/api/client.ts`
  but is **not yet wired into the context** — the planned hook (`useUploadContent` /
  `useDownloadContent`) will need `contentFetch` added to `NavigatorDataContextValue` and
  `NavigatorDataProvider`.
- Content PUT returns 204 No Content — use `fetchVoid` (not yet implemented) rather than `fetchHal`.

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
