# Contract: view toolbar

**Requirements**: FR-021, FR-022, FR-023, FR-024, FR-025
**Package**: `packages/views`; shared toolbar layout (today `BreadCrumbsToolBarLayout`, moves with `features/layout` in PR 7)

## Rules

1. **Views draw the toolbar.** A view draws breadcrumbs on the left and actions on the right, using the shared toolbar layout.
2. **Every click goes through the navigation object, called by the view** (`openHome`, `openEntityItemCollection`, `openItem`), never the router (see [navigation-context.md](navigation-context.md)).
3. **A host or parent can turn it off.** Every view that draws a toolbar accepts a way to hide it. A split view draws one toolbar for both panes; the chat panel may draw none. When hidden, the view still works; its actions are the host's responsibility.
4. **Features never draw a toolbar or breadcrumbs.** `EntityItemView` and `EntityItemCollectionSearchView` lose their `toolbar`, `breadcrumbs`, `actions` props and their `PageLayout` wrapper (PR 5).
5. **Everything fills the space it gets.** Views and features take the full size of their parent and can shrink so inner lists scroll (the `h-full min-h-0` pattern). They add no outer padding and never size themselves to the window (no `h-svh`, `vh` units, fixed widths). Only the outermost host sets real sizes.
6. **The default toolbar is computed from the data the view loaded** (for example breadcrumb labels), consistent with constitution Principle VIII; it stays overridable.

## Test obligations

- Each view story renders in a fixed-size box in the visual snapshot suite (ADR-009) and does not overflow it.
- A view with the toolbar off renders no breadcrumb and no toolbar actions.
- Each breadcrumb click in a test calls the recording navigation fake with the expected function and arguments.
