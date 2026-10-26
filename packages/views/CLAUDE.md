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
- **Only views call `useViewNavigation()`; no router in views or features.** Every click that opens something,
  including one reported by a feature through a callback prop that its view wires up, calls it
  ([contract](../../specs/005-views-layer/contracts/navigation-context.md)). One-page-only actions stay props.
- Each view declares its own explicit props (e.g. `entityName` + `itemId`, `toolbar?: ViewToolbarConfiguration`
  where `ViewToolbarConfiguration = { actions?: ReactNode } | false | undefined`) and calls navigator-data's
  hooks itself. No shared props or target type ([contract](../../specs/005-views-layer/contracts/view-props-and-state.md)).
- A view that has list state (filters, sort, page, …) takes it bundled as an optional `state` / `onStateChange`
  pair — never as separate top-level props — and exports its own state type for it; with neither `state` nor
  `onStateChange` passed, the view MUST still work correctly, keeping that state internally. A view with no
  such state exports no state type and takes neither prop.
- Exporting a preload is per view, not a requirement every view meets: a view MAY export its own small preload
  function (e.g. `preloadEntityItemDetail(ctx, entityName, itemId)`) for a route that wants to start loading
  before mount. Where one exists, the route loader calls it directly; it fills the cache via navigator-data's
  ensure helpers, never rejects, and returns while the API client is absent
  ([contract](../../specs/005-views-layer/contracts/view-data-loading.md)).
- Views draw the toolbar; features fill the space they get ([contract](../../specs/005-views-layer/contracts/view-toolbar.md)).
- Each view MUST be its own `exports` entry, so its stability tag can be resolved per view (tag moves here
  in a later PR).

## Navigation

- `NavigationProvider` is supplied by the host; `useViewNavigation()` throws in development without one.
- `ChildNavigationProvider` gives a child view its own navigation object; any call it doesn't override
  goes to the parent's navigation.
- The app's real `Navigation`, `RouterNavigationProvider` (backed by `@tanstack/react-router`), lives in
  each app's own `src/routes/-router-navigation-provider.tsx` — not in this package. The leading `-` keeps
  TanStack Router's file-based router from treating it as a route. Views and features never import
  `@tanstack/react-router`; only `apps/*` may.
- Every `open*` takes a trailing optional `options?: NavigationOptions` (`{ openInNewTab?: boolean }`, default
  `false`). The view decides — the item detail view's "create missing relation target" passes
  `{ openInNewTab: true }` — and a host that can't open tabs may ignore it. The recording fake records `options`
  as the last element of `args` only when it was passed.
- `NavigationLink` (from `../navigation`) renders a real `<a href>` when `Navigation.hrefFor` gives one —
  so cmd/middle-click, "copy link" and screen-reader link semantics work — falling back to a `<button>`
  otherwise; a plain left click calls `onNavigate()` itself, every other click is left to the browser.
- `@contentgrid/views/recording-navigation` ships `createRecordingNavigation()` and `withRecordingNavigation()` (Storybook decorator)
  for stories and tests. Assert on `calls`, never on the router.

## Views

- `@contentgrid/views/entity-item-detail`: `EntityItemDetailView(ViewProps & EntityItemTarget)`, opened by
  `{ entityName, itemId }` or by `{ itemUrl }`. The view resolves the target itself with `useEntityItemTarget`
  (`src/hooks/`), which finds the profile by name or through `describesUrl`, never by reading the name from the
  link. Both modes share `useEntityItem`'s cache key. The view draws the loading, error and not-found states and
  the toolbar, then hands the loaded `entityItem` to `EntityItemContentFocusBody` from
  `@contentgrid/features/entity-item`. The toolbar is drawn from the `EntityItemTargetResult` in every state,
  each crumb as soon as it is known. `ViewProps`/`ViewToolbarConfiguration` live in `src/types/view.tsx`;
  `EntityItemTarget`/`EntityItemTargetResult` next to the hook. The relation-problem dialog lives in the view; relation
  "create new" goes through `navigation.openCreateItem`. `preloadEntityItemDetail` covers the by-name mode only.

- `@contentgrid/views/entity-item-collection`: `EntityItemCollectionView(ViewProps & EntityItemCollectionTarget &
{ state?, onStateChange? })`, opened by `{ entityName }` or `{ collectionUrl }`. The view resolves only the profile
  (`useProfileEntityTarget`) and owns the `CollectionViewState` (`filters`, `sort`, `pageUrl`), controlled or internal;
  the `entity-item-collection` feature gets the loaded profile and the state, and fetches the page itself. A link
  starts as the shown page, with the filter values it carries for the search template's own fields. Toolbar: Home ›
  collection, plus a create action gated on `profileEntity.createTemplate`.

## Breadcrumbs

- `src/breadcrumbs/` builds every trail from the same crumbs: `HomeBreadcrumb`, `CollectionBreadcrumb` and
  `ItemBreadcrumb`, each rendering its `children` crumbs after itself. A crumb with children is a link; the last one
  is the current page. A crumb draws nothing until its data is known, so pages nest them without conditions. Each
  page has its own export (`EntityItemCollectionBreadcrumbs`, `EntityItemDetailBreadcrumbs`); each view draws its
  own toolbar around it.

## Testing

Vitest + Testing Library next to the code (`views` project in the root `vitest.config.ts`). Stories render in a
fixed-size box for the visual snapshots ([ADR-009](../../docs/adr/ADR-009-visual-regression-playwright-snapshots.md)).
