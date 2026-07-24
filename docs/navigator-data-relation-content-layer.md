# Navigator-data — relation and content mutation layer

**Date:** 2026-07-07
**Scope:** `packages/navigator-data` — relation accessors, relation read/mutation hooks, binary content hooks, and the hooks-directory restructure that ships alongside them.
**Related:** [ADR-001](adr/ADR-001-state-management-zustand-tanstack-query.md) (TanStack Query), [ADR-007](adr/ADR-007-two-layer-dependency-model.md) (two-layer dependency model), [ADR-014](adr/ADR-014-hal-contract-tests-msw.md) (HAL contract tests with MSW), [`packages/navigator-data/CLAUDE.md`](../packages/navigator-data/CLAUDE.md) (canonical hook/accessor conventions).

---

## 1. Overview

This branch completes the relation and binary-content legs of the navigator-data mutation layer. Before this work, `EntityItem` only exposed attribute read/update/delete; relations and content were unimplemented. The branch adds:

- Two cardinality-specific relation accessor classes (`EntityItemToOneRelation`, `EntityItemToManyRelation`) that read HAL-FORMS relation templates and build request objects.
- Relation **read** hooks (`useEntityItemToOneRelation`, `useEntityItemToManyRelation`) with three fetch modes each.
- Relation **mutation** hooks (`useSetToOneRelation`, `useAddToManyRelation`, `useClearRelation`, `useUnlinkRelation`, `useDeleteRelationItem`) sharing a common base implementation.
- A binary content layer (`useUploadContent`, `useDownloadContent`, `contentDispositionAttachment`/`parseContentDisposition`, and a second `contentFetch` client threaded through `NavigatorDataProvider`).
- A restructure of `src/hooks/` into `profile/`, `collection/`, `item/`, and `relation/` subfolders.
- Two new query-key namespaces (`toOneRelation`, `toManyRelation`) keyed by relation **name**, distinct from the entity-keyed `entityItem`/`entityItemCollection` namespaces.

Every claim below was checked against the source in this worktree (branch `docs/navigator-data-layer-consolidation`) — file and line references are given so they can be re-verified after future changes.

---

## 2. Architecture

Per the two-layer dependency model (ADR-007), this package (Layer 2) composes the seven `@contentgrid/*` core packages (Layer 1) into a navigator-specific API. The relation/content work follows the existing three-tier shape used by the rest of the package:

```
Accessor classes            →  Query-option factories        →  React hooks
(wrap a parsed HAL resource,   (pure functions returning        (call the TanStack hook,
 own request builders and       TanStack `queryOptions` /        resolve accessor + apiFetch,
 template/capability getters)   `useMutation` config)            own cache invalidation)
```

- **Accessors** (`src/accessors/entity-item-to-one-relation.ts`, `src/accessors/entity-item-to-many-relation.ts`) carry `name`, `link`, `profileRelation`, and `source` (the owning `EntityItem`). They expose template-presence capability flags (`canSet`/`canClear`/`canAdd`) and request builders (`setRelationRequest`, `addRelationRequest`, `clearRelationRequest`) that return a bare `Request` — no `If-Match`, no execution.
- **Static query factories** on the same classes (`EntityItemToOneRelation.fetchQuery`, `EntityItemToManyRelation.fetchQuery`) return TanStack `queryOptions`, keyed under the new relation namespaces (`src/query-keys.ts`).
- **Hooks** (`src/hooks/relation/*.ts`) call `useNavigatorData()` for `apiFetch`/`contentFetch`, resolve the target profile via `useProfileEntities()`, and own `onSuccess`/`onSettled` cache invalidation.

This mirrors the entity-item mutation pattern already documented in CLAUDE.md's "Mutation hook authoring recipe" — the relation and content hooks are new instances of the same shape, not a new pattern.

---

## 3. Relation read model

### 3.1 Three modes

`useEntityItemToOneRelation(relation, options?)` (`src/hooks/relation/use-entity-item-to-one-relation.ts`) has one mode: it always fetches the relation's own link (`relation.link.href`) and returns `EntityItem | null` (`null` on a 404, meaning an empty to-one slot).

`useEntityItemToManyRelation(relation, params?, options?)` (`src/hooks/relation/use-entity-item-to-many-relation.ts`) supports a discriminated union `RelationCollectionParams`:

| Mode          | Params             | Behavior                                                                         |
| ------------- | ------------------ | -------------------------------------------------------------------------------- |
| **Default**   | omitted            | Fetches `relation.link.href` — the relation's first page.                        |
| **By URL**    | `{ url }`          | Fetches a specific page (from `collection.nextHref`/`prevHref`).                 |
| **By search** | `{ searchValues }` | Relation-scoped search — see §3.2. `searchValues: undefined` disables the query. |

Both hooks call `useProfileEntities()` unconditionally (Rules of Hooks) and resolve the target profile via `relation.profileRelation.getTargetProfile(profiles)` before building query options — so both hooks are disabled until the target profile is available. While unresolved, each hook substitutes a stable placeholder `queryKey` (`["ToOneRelation", relation.name, null]` for the to-one hook; a static `["ToManyRelation", "__placeholder__"]` constant for the to-many hook) with `enabled: false`, matching the pattern already used by `useProfileEntity` for unresolved `cg:entity` links.

`getTargetProfile` (`src/accessors/relation-profile.ts:97-101`) deliberately does **not** use `profile.describes()`. It matches the target profile by its own self-link href against the relation's `blueprint:target-entity` link href, because `describes()` links carry collection/item URL _templates_ (e.g. `/products`, `/products/{id}`), not the profile resource's own URL.

### 3.2 The 302-redirect scoping mechanism

Following a `cg:relation` link (e.g. `GET /invoices/123/products`) causes the server to 302-redirect to the target entity's own collection with an internal scoping query parameter, e.g.:

```
GET /invoices/123/products
→ 302 → /products?_internal_invoice__products=019d2aee-…&_size=20&_cursor=…
```

`EntityItemCollection.internalRelationParams` (`src/accessors/entity-item-collection.ts:306-321`) extracts these params from `halSlice.self.href` (the _resolved_ URL, post-redirect), stripping `_cursor`, `_size`, and `_sort`. This only works after the base collection has actually been fetched — the scoping params cannot be derived from `relation.link.href` up front.

For **by-search** mode, `useEntityItemToManyRelation` (`src/hooks/relation/use-entity-item-to-many-relation.ts:138-166`):

1. Runs a `baseQuery` against `relation.link.href` (same cache key as default mode — typically a cache hit if a default-mode call is also mounted) to obtain `internalRelationParams`.
2. Calls `targetProfile.searchTemplate.withHiddenParams(internalRelationParams)` (`src/accessors/extended-forms/search-form.ts:297-304`) to bake the scoping params in as hidden HAL-FORMS properties — the codec only encodes properties declared on the template, so unde­clared query params would otherwise be silently dropped.
3. Encodes the scoped URL via `halFormCodecs.requireCodecFor(scopedTemplate.template)` with `createValues(scopedTemplate.template).withValues(searchValues.valueMap)`.
4. Fetches the encoded URL as the search result, under the same `toManyRelation` query-key namespace.

Both the base query and the main query are marked `enabled: false` until every prerequisite resolves (`targetProfile`, and for search mode, `internalRelationParams`). Pagination of a scoped search result uses `{ url: collection.nextHref }` — the server's `next`/`prev` links already carry the `_internal_*` params, so no re-encoding is needed on page 2+.

This is an explicit workaround: the server does not yet emit relation-scoping params in the search template itself. Replace the base-fetch-then-inject step with a template-driven approach if/when the server adds native support.

---

## 4. Relation mutation model

### 4.1 Template-driven, ABAC-gated

All relation mutations are driven by HAL-FORMS templates on the source item, following the same rule as entity-item mutations (CLAUDE.md rule 1 and 2): template absence is the ABAC deny signal.

| Operation       | Template      | Capability flag                     | Request builder            |
| --------------- | ------------- | ----------------------------------- | -------------------------- |
| Set (to-one)    | `set-<rel>`   | `EntityItemToOneRelation.canSet`    | `setRelationRequest(uri)`  |
| Clear (to-one)  | `clear-<rel>` | `EntityItemToOneRelation.canClear`  | `clearRelationRequest()`   |
| Add (to-many)   | `add-<rel>`   | `EntityItemToManyRelation.canAdd`   | `addRelationRequest(uris)` |
| Clear (to-many) | `clear-<rel>` | `EntityItemToManyRelation.canClear` | `clearRelationRequest()`   |

Request builders throw synchronously (before any network call) when the template is absent — see `setRelationRequest` (`src/accessors/entity-item-to-one-relation.ts:179-192`) and `addRelationRequest` (`src/accessors/entity-item-to-many-relation.ts:161-174`). Both encode via `halFormCodecs.requireCodecFor(template)` against the template's first declared property, producing a `text/uri-list` body (one URI per line for `add`, a single URI for `set`).

### 4.2 If-Match / ETag flow

Request builders return a **bare** `Request` — they do not attach `If-Match`. The shared mutation base (`src/hooks/relation/use-relation-mutation-base.ts:61-71`) attaches it from `relation.source.etag` via `addIfMatchHeader` immediately before calling `fetchVoid`. This is the same "hook attaches If-Match, accessor does not" split used for entity-item mutations, applied consistently to relations.

`useUnlinkRelation` and `useDeleteRelationItem` do not go through the shared base (they have different request shapes — a hand-built DELETE and a full entity delete, respectively) but follow the identical If-Match pattern locally: `addIfMatchHeader(baseReq, relation.source.etag)` for unlink, `addIfMatchHeader(baseReq, item.etag)` for delete (using the _target_ item's own etag, since deleting the item is gated on the item's own state, not the source's).

All non-2xx responses surface to the caller as `ProblemDetailError` (via `checkResponse`/`fetchVoid`) and no relation hook auto-retries. Structured problem-details handling at call sites is still a TODO; the per-problem-type contract will be documented when that leg lands.

---

## 5. Cache-key and invalidation strategy

### 5.1 Query-key shape

`src/query-keys.ts` adds two namespaces, both keyed by the relation **name** (a string), not by `ProfileEntity`:

```ts
queryKeys.toOneRelation.forRelationName(relationName); // prefix
queryKeys.toOneRelation.byUrl(relationName, relationUrl); // exact
queryKeys.toManyRelation.forRelationName(relationName); // prefix
queryKeys.toManyRelation.byUrl(relationName, relationUrl); // exact
```

This is a deliberate departure from `entityItem`/`entityItemCollection`, which key by `ProfileEntity`. A relation read is scoped to one named relation on one source item's link — the target entity type is not the natural partition key here. Root strings are `"ToOneRelation"` / `"ToManyRelation"`, distinct from `"EntityItem"` / `"EntitySearch"`, so there is no accidental prefix collision.

### 5.2 Per-hook invalidation table

| Hook                    | On                         | Invalidates                                                                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSetToOneRelation`   | settled (success or error) | `toOneRelation.byUrl(relation.name, relation.link.href)` **and** `entityItem.byUrl(source.profileEntity, source.selfLink.href)`                                                                                                              | Relation response must be refetched; source item's ETag may have been bumped by the operation — refresh it to avoid a spurious 412 on the next mutation.                                                                                                                |
| `useAddToManyRelation`  | settled                    | `toManyRelation.byUrl(relation.name, relation.link.href)` **and** `entityItem.byUrl(source)`                                                                                                                                                 | Same as above, to-many.                                                                                                                                                                                                                                                 |
| `useClearRelation`      | settled                    | The relation read key matching the runtime cardinality (`relation instanceof EntityItemToOneRelation`) **and** `entityItem.byUrl(source)`                                                                                                    | Same rationale; cardinality is resolved at runtime since the hook accepts either relation type.                                                                                                                                                                         |
| `useUnlinkRelation`     | settled                    | `toManyRelation.forRelationName(relation.name)` (**prefix** — all pages) **and** `entityItem.byUrl(source)`                                                                                                                                  | Removing one item can shift page boundaries for every other cached page of this relation, so a single exact-key bust is insufficient.                                                                                                                                   |
| `useDeleteRelationItem` | success only               | `entityItem.byUrl` removed for the deleted item (`removeQueries`), `entityItemCollection.forEntity` invalidated, and the relation read key — `toOneRelation.byUrl` (exact) for to-one, `toManyRelation.forRelationName` (prefix) for to-many | The item is gone globally, not just from this relation, so the global item cache and collection cache are also cleaned up. No source-item invalidation — this hook does not attach the _source_ item's ETag (it deletes the _target_ item using the target's own ETag). |

The set/add/clear source-item invalidation is **unconditional** — `relation.source.profileEntity` and `relation.source.selfLink.href` are always available synchronously off the bound `relation` object, so there's no dependency on a profile query settling first.

None of the set/add/clear/unlink hooks use `setQueryData` — they invalidate and let the read hook lazily refetch. Only `useUploadContent` (content layer) and the generic entity-item mutation recipe use `setQueryData` to populate a fresh value directly.

---

## 6. Content layer

Binary content (PUT/GET to `cg:content` links) is the one documented exception to the HAL-FORMS-template rule (CLAUDE.md, "Content exception"): there is no `_templates` entry for content, so the `Request` is built by hand from the link href, gated on link _presence_ rather than template presence.

### 6.1 `contentFetch` — why a second client

`NavigatorDataProvider` (`src/hooks/context.tsx`) now threads two `TypedFetch` clients:

- `apiFetch` — built by `createApiClient` (`src/api/client.ts`), sets `Accept: application/prs.hal-forms+json, application/hal+json, application/json` (the `ACCEPT_HAL` constant) on every request.
- `contentFetch` — built by `createContentClient`, which composes the same bearer-auth and problem-details hooks but **omits** the `Accept: application/hal+json` header.

Both clients share the bearer-auth hook and the `problemDetailsHook` (`checkResponse` on every response) — the only difference is the `Accept` header. This matters because content GET/PUT talks to S3-backed binary endpoints, not HAL JSON resources; forcing a HAL `Accept` header on a binary request has no benefit and is semantically wrong.

### 6.2 `useUploadContent` / `useDownloadContent`

`src/hooks/item/use-content.ts`:

- `entityItem.uploadContentRequest(attrName, file, opts?)` and `entityItem.downloadContentRequest(attrName, opts?)` (`src/accessors/entity-item.ts:374-450`) build the `Request` — gated on `entityItem.canUploadContent(attrName)` (link presence). Upload attaches `If-Match` from the item's own etag when available; it is omitted (not sent) when `etag === null`.
- `useUploadContent` sends the PUT via `fetchVoid(contentFetch, req)` (204 response), then **re-fetches the parent item via `apiFetch`** to capture the fresh ETag and full metadata, and populates the item cache with `setQueryData` plus invalidates `entityItemCollection.forEntity`.
- `useDownloadContent` is a `useMutation`, not a query — it's imperative (triggered by a download button click) and blobs are never cached. It returns a `ContentDownload` (`{ blob, mimetype, filename, contentLength, isPartial }`); `isPartial` is `true` when the response status is `206` (a `Range` request was honored).

### 6.3 Filename handling (RFC 6266 / RFC 5987)

`src/api/content-types.ts` implements both directions:

- `contentDispositionAttachment(filename)` — builds the outgoing `Content-Disposition` header for uploads. ASCII filenames use RFC 6266 quoted-string form (`filename="..."`, backslash-escaping only `"` and `\`); non-ASCII filenames use the RFC 5987/RFC 8187 extended form (`filename*=UTF-8''<percent-encoded>`).
- `parseContentDisposition(header)` — parses the incoming header on download, preferring the `filename*=` extended form (percent-decoded) and falling back to the quoted or bare `filename=` form.

---

## 7. `src/hooks/` restructure

Hooks now live in resource-kind subfolders (`profile/`, `collection/`, `item/`, `relation/`); `src/hooks/context.tsx` (provider/context) and `src/hooks/index.ts` (barrel) stay at the top level. Imports from outside the package are unaffected — the public barrel (`@contentgrid/navigator-data` → `src/index.ts` → `src/hooks/index.ts`) is unchanged in shape; git tracks the individual renames.

---

## 8. Known temporary deviations and follow-ups

These are explicit, contained workarounds pending server-side changes — not modeling mistakes. Each is called out in code comments at the cited location; do not generalize the pattern elsewhere.

1. **Hand-built per-item unlink URL, ungated capability flag.**
   `EntityItemToManyRelation.unlinkItemRequest(item)` (`src/accessors/entity-item-to-many-relation.ts:143-145`) builds `DELETE ${this.link.href}/${item.id}` by hand because the server does not yet emit a per-item HAL-FORMS delete template for to-many relation members. Consequently `canUnlinkItem` (`entity-item-to-many-relation.ts:128-130`) is hardcoded `true` — there is no template to gate on, and the server enforces ABAC at request time (403 on deny) instead of via affordance hiding. **Follow-up:** once the server adds a per-item template, replace `unlinkItemRequest` with a template-driven builder and derive `canUnlinkItem` from template presence, matching every other capability flag in this layer.

2. **Relation-scoped search requires a base-collection fetch first.**
   The scoping mechanism described in §3.2 depends on fetching the base relation collection to read `internalRelationParams` off the _resolved_ URL, then re-injecting those params into the search template as hidden properties. This only works because the server currently returns the scoping params via a 302 redirect rather than exposing them directly on the search template. **Follow-up:** if the server starts emitting relation-scoping params directly in the search template (or as a documented, stable query parameter), remove the base-fetch step in `useEntityItemToManyRelation` and encode search requests in one round trip.

3. **`queryKeys.toOneRelation`/`toManyRelation` naming: relation-name-keyed, not entity-keyed.**
   This is an intentional design choice (§5.1), not a bug, but it is a deviation from the `entityItem`/`entityItemCollection` convention of keying by `ProfileEntity`. If two different source entity types ever expose relations with the same name to structurally different targets, their relation-read caches would share a `forRelationName` prefix. This has not caused an observed problem, but is worth keeping in mind if a future change needs per-source-entity relation cache isolation.
