# Contract: view preload

**Requirements**: FR-003, FR-004, FR-027
**Package**: `packages/views`; existing query factories from `packages/navigator-data`

## Signature

Each view MAY export its own small preload function, shaped around that view's own props — there is no shared, generic `ViewPreload<S>` type:

```ts
type EntityItemDetailViewPreload = (
  ctx: AppRouterContext,
  entityName: string,
  itemId: string,
) => Promise<void>;
```

`ctx` is the router context: the query client and the API client. A view with state takes its state the same way its own props do (see [view-props-and-state.md](view-props-and-state.md)); a view with no state takes none.

## `ensureQueryData` and TanStack Router

A preload is a thin wrapper around the query client's `ensureQueryData(...)`, called once per query the view's own hooks read, using `navigator-data`'s existing query factories (`profileByLinkQuery`, `fetchByUrlQuery`, `infiniteQuery`, `profileRootQuery`, …). No new query keys are introduced for preloading. The route's TanStack Router `loader` calls the view's preload directly with the route's own parameters; `pendingComponent`, `errorComponent` and `notFoundComponent` stay the router's, driven by the same query state the view reads when it renders.

```ts
// apps/*/src/routes/_app/$entity/$itemId.tsx
loader: ({ context, params }) =>
  entityItemDetailViewPreload(context, params.entity, params.itemId),
```

Because the preload and the view call the exact same query factory with the exact same arguments, the loader's `ensureQueryData` call and the view's own read hit the same cache entry — the view's first render is a cache read, not a second fetch.

## Rules

1. **The route loader calls it.** The app's route loader reads URL parameters and calls the view's preload directly with them; the app never loads a `ProfileEntity` or other domain object itself.
2. **Loads what the view reads, under the same keys.** A preload fills the cache with the data the view's own hooks read first (profile entity, then the item or the first collection page), via the same `navigator-data` query factory the view uses, so the view resolves from cache. It starts loading only the main data (FR-004), not relations or previews.
3. **Never blocks the page on failure** _(carried over from current behaviour)_. A preload swallows failures (as `ensureEntityItemDetailLoaderData` does today) so the view's own loading, error and not-found handling still runs. It resolves when the data is cached or when it gave up.
4. **Skips when not ready** _(carried over from current behaviour: the loader skips while the API client is null)_. If the API client is not yet available (auth not finished), a preload returns without loading.
5. **Parents call children.** A parent's preload calls each child's preload with that child's own props, and awaits them together (FR-027).

## Test obligations

- After `preload`, rendering the view makes no further request for the main data.
- `preload` resolves (does not reject) when the API client is absent or a request fails.
- A parent preload triggers each child's preload once.
