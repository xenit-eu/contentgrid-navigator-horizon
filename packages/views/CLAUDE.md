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
- Views take `ViewProps<S>`: a `ViewTarget` (`name` or `url`, never a frontend address, never filters, sort
  or page), optional `state` and `onStateChange` ([contract](../../specs/005-views-layer/contracts/view-props-and-state.md)).
  State is serialisable plain data defined by the view.
- Each view exports its own `preload` ([contract](../../specs/005-views-layer/contracts/view-preload.md)):
  it fills the query cache under the keys the view reads, never rejects, and returns when the API client is absent.
- Views draw the toolbar; features fill the space they get ([contract](../../specs/005-views-layer/contracts/view-toolbar.md)).
- Each view is its own `exports` entry so its stability tag can be resolved per view (tag moves here in a later PR).

## Navigation

- `NavigationProvider` is supplied by the host; `useNavigation()` throws in development without one.
- `ChildNavigationProvider` gives a child view its own navigation object; calls it does not override go to the parent's.
- `@contentgrid/views/testing` ships `createRecordingNavigation()` and `withRecordingNavigation()` (Storybook decorator)
  for stories and tests. Assert on `calls`, never on the router.

## Views

- `@contentgrid/views/entity-item-detail`: `EntityItemDetailView` and its `preload`. Its data comes from
  `useViewTarget` through the shared `ViewTargetGate` (loading, error and not-found in one place); the
  relation-problem dialog lives in the view.

## Testing

Vitest + Testing Library next to the code (`views` project in the root `vitest.config.ts`). Stories render in a
fixed-size box for the visual snapshots ([ADR-009](../../docs/adr/ADR-009-visual-regression-playwright-snapshots.md)).
