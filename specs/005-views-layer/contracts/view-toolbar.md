# Contract: view toolbar

**Requirements**: FR-021, FR-022, FR-023, FR-024, FR-025
**Package**: `packages/views`; shared toolbar layout (`BreadCrumbsToolBarLayout`, in `packages/views/src/layout/` since PR 5)

## Rules

1. **Views draw the toolbar.** A view draws breadcrumbs on the left and actions on the right, using the shared toolbar layout.
2. **Every click goes through the navigation object, called by the view** (`openHome`, `openEntityItemCollection`, `openItem`), never the router (see [navigation-context.md](navigation-context.md)).
3. **A host or parent can turn it off, or add to it.** Every view that draws a toolbar accepts `toolbar?: ViewToolbarConfiguration` (see [view-props-and-state.md](view-props-and-state.md)): `false` hides it, `undefined`/`{}` draws the view's own default, and `{ actions }` keeps the default toolbar but adds the host's actions next to the view's own. A split view draws one toolbar for both panes; the chat panel may draw none. When hidden, the view still works; its actions are the host's responsibility.
4. **Features never draw a toolbar or breadcrumbs.** `EntityItemView` loses its `toolbar`, `breadcrumbs`, `actions` props and its `PageLayout` wrapper, and its own data loading: it takes an already-loaded `item: EntityItem` prop instead of resolving one itself, and fills whatever space its parent gives it. `EntityItemContentFocusBody` (the content-focus variation's entry point) takes an already-loaded `entityItem` the same way. `EntityItemCollectionSearchView` is removed outright rather than stripped — the collection view in `packages/views` places the plain `EntityItemCollectionView` (features), which never had toolbar/breadcrumbs/actions/`PageLayout` of its own, so there was nothing left for the wrapper to do (PR 4).
5. **Everything fills the space it gets.** Views and features take the full size of their parent and can shrink so inner lists scroll (the `h-full min-h-0` pattern). They add no outer padding and never size themselves to the window (no `h-svh`, `vh` units, fixed widths). Only the outermost host sets real sizes.
6. **The default toolbar is computed from the data the view loaded** (for example breadcrumb labels), consistent with constitution Principle VIII.

## Test obligations

- Each view story renders in a fixed-size box in the visual snapshot suite (ADR-009) and does not overflow it.
- A view with the toolbar off renders no breadcrumb and no toolbar actions.
- Each breadcrumb click in a test calls the recording navigation fake with the expected function and arguments.
