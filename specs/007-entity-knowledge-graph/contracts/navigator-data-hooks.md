# Contract: navigator-data additions

**Package**: `packages/navigator-data` — exported from `@contentgrid/navigator-data`.
Every hook below ships with an MSW-backed contract test and updated handler fixtures
(constitution, Development Workflow).

## 1. `useEntityItemRelationTargets` (NEW)

`src/hooks/relation/use-entity-item-relation-targets.ts`

```ts
function useEntityItemRelationTargets(
  entityItem: EntityItem | undefined,
  options?: { enabled?: boolean },
): {
  relations: readonly RelationTargets[]; // see data-model.md §3; order = profile order,
  // to-one first then to-many (matches EntityItem getters)
  isPending: boolean; // any relation pending
};
```

- Relation list: `entityItem.toOneRelations` + `entityItem.toManyRelations` (only relations whose
  `cg:relation` link is present — ABAC-hidden relations never appear).
- Target profile: `relation.profileRelation.getTargetProfile(profiles)` with profiles from
  `useProfileEntities()`; a relation whose target profile is unresolved stays `pending`.
- Queries: `useQueries` over `relation.fetchQuery(apiFetch, targetProfile)` — **same keys** as
  `useEntityItemToOneRelation` / `useEntityItemToManyRelation` (`toOneRelation.byUrl`,
  `toManyRelation.byUrl`), so cache and existing mutation invalidation are shared.
- To-one 404 → `target: null` (existing factory behaviour). To-many returns the first page at the
  server's default page size; the hook does **not** slice.
- Rules-of-Hooks safe with `entityItem === undefined` (returns `[]`, `isPending: true`).

Contract test: invoice fixture with `supplier` (to-one, set), `lineItems` (to-many, 25 with
`total_items_exact`), one to-one returning 404, one relation link absent → assert 3 entries,
statuses, `null` target, totals.

## 2. `useEntityItemToManyRelationInfinite` (NEW)

`src/hooks/relation/use-entity-item-to-many-relation-infinite.ts`

```ts
function useEntityItemToManyRelationInfinite(
  relation: EntityItemToManyRelation | undefined,
  options?: { enabled?: boolean },
): UseInfiniteQueryResult<InfiniteData<EntityItemCollection, string>, Error>;
```

- Initial URL `relation.link.href`; `getNextPageParam = page => page.nextHref ?? undefined`
  (links only, never built).
- Key: `queryKeys.toManyRelation.infiniteByUrl(relation.name, relation.link.href)` =
  `[ToManyRelation, relName, url, "infinite"]` (NEW key factory; prefix-matched by
  `toManyRelation.forRelationName`, so `useUnlinkRelation` / `useClearRelation` invalidation
  refreshes the list).

Contract test: two cursor pages; `fetchNextPage` requests exactly the `next` href; after
`useUnlinkRelation` success the infinite query is invalidated.

## 3. `useDeleteEntityItem` (CHANGED)

`src/hooks/item/use-delete-entity.ts` — on success, additionally
`invalidateQueries({ queryKey: [ToOneRelation] })` and `[ToManyRelation]` roots (new
`queryKeys.toOneRelation.all()` / `toManyRelation.all()`), because any relation anywhere may have
listed the deleted item. Existing behaviour (If-Match from `item.etag`, `removeQueries`
`entityItem.byUrl`, invalidate `entityItemCollection.forEntity`) unchanged.

Contract test: extend existing delete test — a cached to-many relation containing the item is
refetched after delete.

## 4. Test fixtures (NEW)

`test-fixtures/msw/relation-demo-handlers.ts` — `createRelationDemoHandlers(baseUrl)`: stateful
in-memory model (customer / order / product / employee) per research R15, with `set-`/`clear-`/
`delete` templates present or absent per item, `total_items_estimate` on one large relation,
a self-relation, and a required relation producing `integrity/required-relation` on delete.
Exported via `@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers`.

## Unchanged, reused as-is

`useClearRelation`, `useUnlinkRelation` (documented `unlinkItemRequest` exception — not extended),
`useEntityItem`, `useProfileEntities`, `EntityItemToOneRelation.canClear`,
`EntityItemToManyRelation.canUnlinkItem`, `EntityItem.canDelete`, `toProblemDisplayModel`.
