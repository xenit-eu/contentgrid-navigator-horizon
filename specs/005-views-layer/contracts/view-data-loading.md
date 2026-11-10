# Contract: view data loading

**Requirements**: FR-003, FR-004, FR-005, FR-027
**Package**: `packages/views`; `ensure*` helpers from `packages/navigator-data`

## `ensureQueryData` and TanStack Router

A route starts loading a view's data before it mounts through a TanStack Router `loader`, not a generic preload contract. A view that benefits from it exports its own small, plainly-named function, shaped around that view's own props — there is no shared `ViewPreload<S>` type, and not every view exports one. Where a view does, it is named `preload<ViewName>`:

```ts
function preloadEntityItemDetail(
  ctx: AppRouterContext,
  entityName: string,
  itemId: string,
): Promise<void>;
```

`ctx` is the router context: the query client and the API client. A view with state takes its state the same way its own props do (see [view-props-and-state.md](view-props-and-state.md)); a view with no state takes none.

A preload function is a thin wrapper around `navigator-data`'s own `ensure*` helpers (`ensureProfileEntity`, `ensureEntityItem`, …), each of which calls the query client's `ensureQueryData(...)` with the exact query factory the view's own hooks read — no new query keys, and no helper added to `navigator-data` for this beyond the `ensure*` functions it already has. The route's TanStack Router `loader` calls the view's preload directly with the route's own parameters.

```ts
// apps/*/src/routes/_app/$entity/$itemId.tsx
loader: ({ context, params }) =>
  preloadEntityItemDetail(context, params.entity, params.itemId),
```

Because the preload and the view call the exact same query factory with the exact same arguments, the loader's `ensureQueryData` call and the view's own read hit the same cache entry — the view's first render is a cache read, not a second fetch.

## Rules

1. **The route loader calls it.** The app's route loader reads URL parameters and calls the view's preload directly with them; the app never loads a `ProfileEntity` or other domain object itself.
2. **Loads what the view reads, under the same keys.** A preload fills the cache with the data the view's own hooks read first (profile entity, then the item or the first collection page), via the same `navigator-data` query factory the view uses, so the view resolves from cache. It starts loading only the main data (FR-004), not relations or previews.
3. **Never blocks the page on failure** _(carried over from current behaviour)_. A preload swallows failures (as `ensureEntityItemDetailLoaderData` does today) so the view's own loading, error and not-found handling still runs. It resolves when the data is cached or when it gave up.
4. **Skips when not ready** _(carried over from current behaviour: the loader skips while the API client is null)_. If the API client is not yet available (auth not finished), a preload returns without loading.
5. **Parents call children.** A parent's preload calls each child's preload with that child's own props, and awaits them together (FR-027).
6. **A feature may fetch more, only through links it already has** (FR-005). This is a feature-level rule, not a preload rule: a preload loads only the view's main data (rule 2). Beyond that, a feature MAY load additional data that follows from the object its view passed it — but only by following a link already present on that object (e.g. a `cg:relation` or `cg:content` link); it MUST NOT build an address itself. The item detail view's relation popover and content previews are existing examples: both follow links on the loaded `entityItem`, never a hand-built URL.

## Test obligations

- After `preload`, rendering the view makes no further request for the main data.
- `preload` resolves (does not reject) when the API client is absent or a request fails.
- A parent preload triggers each child's preload once.
- A feature that loads data beyond what its view passed it does so via a link already present on that data, never a hand-built URL (FR-005).
