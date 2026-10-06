# Contract: view preload

**Requirements**: FR-003, FR-004, FR-027
**Package**: `packages/views`; data helpers from `packages/navigator-data` (PR 3)

## Signature

```ts
type ViewPreload<S> = (
  ctx: AppRouterContext,
  target: ViewTarget,
  state: S | undefined,
) => Promise<void>;
```

Each view exports its own `preload`. `ctx` is the router context: the query client and the API client. `target` says what to show; `state` says how, and is `undefined` where a view has no state.

## Rules

1. **The route loader calls it.** The app's route loader turns URL parameters into a target and a state and calls the view's `preload`. The app never loads a `ProfileEntity` itself.
2. **Loads what the view reads, under the same keys.** A preload fills the cache with the data the view's own hooks read first (profile entity, then the item or the first collection page), so the view resolves from cache. It starts loading only the main data (FR-004), not relations or previews.
3. **Never blocks the page on failure** _(carried over from current behaviour)_. A preload swallows failures (as `ensureEntityItemDetailLoaderData` does today) so the view's own loading, error and not-found handling still runs. It resolves when the data is cached or when it gave up.
4. **Skips when not ready** _(carried over from current behaviour: the loader skips while the API client is null)_. If the API client is not yet available (auth not finished), a preload returns without loading.
5. **Parents call children.** A parent's preload calls each child's preload with the child's target and its slice of state, and awaits them together (FR-027).
6. **Same helpers as the view.** A preload uses the target-resolution helpers of [view-target.md](view-target.md), so a name and a link share one cache entry.

## Today's equivalent

`ensureEntityItemDetailLoaderData(context, itemId)` in `packages/features/src/entity-item/entity-item-loader.ts`, together with `ensureEntityProfileLoaded` for the profile. The item detail view's preload replaces both for that page (PR 4).

## Test obligations

- After `preload`, rendering the view makes no further request for the main data.
- `preload` resolves (does not reject) when the API client is absent or a request fails.
- A parent preload triggers each child's preload once.
