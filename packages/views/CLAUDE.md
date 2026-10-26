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
- `ChildNavigationProvider` gives a child view its own navigation object; calls it doesn't override go to the parent's navigation.
- Every `Navigation` function takes a trailing optional `options?: NavigationOptions` (`{ openInNewTab?: boolean }`, default
  `false`). The view decides; a host that can't open tabs may ignore it. The recording fake records `options` as the last
  element of `args` only when it was passed.
- `@contentgrid/views/recording-navigation` ships `createRecordingNavigation()` and `withRecordingNavigation()` (Storybook decorator)
  for stories and tests. Assert on `calls`, never on the router.

## Testing

Vitest + Testing Library next to the code (`views` project in the root `vitest.config.ts`). Stories render in a
fixed-size box for the visual snapshots ([ADR-009](../../docs/adr/ADR-009-visual-regression-playwright-snapshots.md)).
