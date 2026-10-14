# packages/views — CLAUDE.md

Package: `@contentgrid/views` (private — not published to npm)
Purpose: the layer between the apps and `@contentgrid/features`. A view takes a target (what to show)
and optional state (how), loads its main data, draws its toolbar and places features or child views.

Spec: [`specs/005-views-layer/`](../../specs/005-views-layer/spec.md). Decision: [ADR-018](../../docs/adr/ADR-018-views-layer.md).

---

## Layer rules

```
apps  ->  views  ->  features  ->  ui  (navigator-data is usable by every layer above ui)
```

- Views import `@contentgrid/navigator-data`, `@contentgrid/features` and `@contentgrid/ui`. Features,
  `navigator-data` and `ui` never import views.
- **Only views call `useNavigation()`; no router in views or features.** Every click that opens something,
  including one reported by a feature through a callback prop that its view wires up, calls it
  ([contract](../../specs/005-views-layer/contracts/navigation-context.md)). One-page-only actions stay props.
- Each view takes the explicit, primitive props it needs (e.g. `entityName`/`itemId`) — never a frontend
  address, filters, sort or page ([contract](../../specs/005-views-layer/contracts/view-props-and-state.md)).
- Each view exports its own, view-specific preload function (e.g. `preloadEntityItemDetail`)
  ([contract](../../specs/005-views-layer/contracts/view-preload.md)): it calls the `ensure*`/query-factory
  helpers `@contentgrid/navigator-data` already has for the data the view reads, never rejects, and returns
  when the API client is absent.
- Views draw the toolbar; features fill the space they get ([contract](../../specs/005-views-layer/contracts/view-toolbar.md)).
- Each view is its own `exports` entry so its stability tag can be resolved per view (tag moves here in a later PR).

## Navigation

- `NavigationProvider` is supplied by the host; `useNavigation()` throws in development without one.
- `ChildNavigationProvider` gives a child view its own navigation object; calls it does not override go to the parent's.
- `@contentgrid/views/testing` ships `createRecordingNavigation()` and `withRecordingNavigation()` (Storybook decorator)
  for stories and tests. Assert on `calls`, never on the router.

## Views

- `@contentgrid/views/entity-item-detail`: `EntityItemDetailView({ entityName, itemId, toolbar? })` and its
  `preloadEntityItemDetail`. The view calls `useProfileEntity` directly for the breadcrumb labels and draws its
  own loading/not-found state for that; the item itself is fetched (and its own loading/error state drawn,
  inside the same breadcrumb toolbar) by `EntityItemContentFocusView` from `@contentgrid/features/entity-item`.
  `preloadEntityItemDetail` fills the same two caches with `ensureProfileEntity`/`ensureEntityItem`. The
  relation-problem dialog lives in the view; relation "create new" goes through `navigation.openCreateItem`.

## Testing

Vitest + Testing Library next to the code (`views` project in the root `vitest.config.ts`). Stories render in a
fixed-size box for the visual snapshots ([ADR-009](../../docs/adr/ADR-009-visual-regression-playwright-snapshots.md)).
