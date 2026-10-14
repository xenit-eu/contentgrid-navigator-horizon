# packages/views — CLAUDE.md

Package: `@contentgrid/views` (private — not published to npm)
Purpose: the layer between the apps and `@contentgrid/features`. Each view declares its own explicit props
(what to show), optionally takes state (how), loads its main data, draws its toolbar and places features or
child views.

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
- Each view declares its own explicit props (e.g. `entityName` + `itemId`, `toolbar?: boolean`) and calls
  navigator-data's hooks itself. No shared props or target type ([contract](../../specs/005-views-layer/contracts/view-props-and-state.md)).
- A view with state (filters, sort, page, …) takes optional `state` / `onStateChange`; with neither it keeps
  its own internal state. State is plain, serialisable data defined by the view.
- A view's own preload (e.g. `preloadEntityItemDetail(ctx, entityName, itemId)`) is called from the route
  loader, fills the cache via navigator-data's ensure helpers, never rejects, and returns while the API
  client is absent ([contract](../../specs/005-views-layer/contracts/view-preload.md)).
- Views draw the toolbar; features fill the space they get ([contract](../../specs/005-views-layer/contracts/view-toolbar.md)).
- Each view MUST be its own `exports` entry, so its stability tag can be resolved per view (tag moves here
  in a later PR).

## Navigation

- `NavigationProvider` is supplied by the host; `useNavigation()` throws in development without one.
- `ChildNavigationProvider` gives a child view its own navigation object; calls it does not override go to the parent's.
- `@contentgrid/views/shells` ships `RouterNavigationProvider`: the app's real `Navigation`, backed by
  `@tanstack/react-router`. It is the one place outside `apps/*` allowed to import the router (root
  `CLAUDE.md`). `openCreateItem` opens the entity's create form in a new tab via
  `@contentgrid/features/router-shell`'s `useOpenInNewTab`.
- `NavigationLink` (from `../navigation`) renders a real `<a href>` when `Navigation.hrefFor` gives one —
  so cmd/middle-click, "copy link" and screen-reader link semantics work — falling back to a `<button>`
  otherwise; a plain left click calls `onNavigate()` itself, every other click is left to the browser.
- `@contentgrid/views/testing` ships `createRecordingNavigation()` and `withRecordingNavigation()` (Storybook decorator)
  for stories and tests. Assert on `calls`, never on the router.

## Views

- `@contentgrid/views/entity-item-detail`: `EntityItemDetailView({ entityName, itemId, toolbar? })` and its
  `preloadEntityItemDetail`. The view fetches the profile (`useProfileEntity`) and then the item
  (`useEntityItem`) itself, drawing its own loading/error state for each in the breadcrumb toolbar it draws
  via `ViewPage` — the toolbar stays up once the profile resolves, even while the item is still loading or
  fails. `preloadEntityItemDetail` fills the same two caches with `ensureProfileEntity`/`ensureEntityItem`.
  `EntityItemContentFocusView` from `@contentgrid/features/entity-item` fills the space it is given with the
  already-loaded profile/item and draws no chrome. The relation-problem dialog lives in the view; relation
  "create new" goes through `navigation.openCreateItem`.
- `@contentgrid/views/entity-item-collection`: `EntityItemCollectionView`, the collection page's toolbar
  (Home, entity name, Create) around the collection feature. The host still passes filter, sort and page
  props until the view owns its state.
- `ViewPage` (`src/toolbar/`) is the page chrome every view uses: toolbar over a padded content area, or a
  plain padded container when the toolbar is hidden. Features placed inside fill the space they get.

## Testing

Vitest + Testing Library next to the code (`views` project in the root `vitest.config.ts`). Stories render in a
fixed-size box for the visual snapshots ([ADR-009](../../docs/adr/ADR-009-visual-regression-playwright-snapshots.md)).
