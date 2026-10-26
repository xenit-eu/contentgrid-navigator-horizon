# Contract: navigation context

**Requirements**: FR-016, FR-017, FR-018, FR-019, FR-020, FR-026
**Package**: `packages/views` (context, `NavigationProvider`, `useViewNavigation()`, `ChildNavigationProvider`, recording fake); implementations live in the hosts — the app's own implementation is a file in that app, not in `packages/views` (see "Hosts" and `research.md` §2.7)

## Shape

The host provides one navigation object through React context. Only views read it, with `useViewNavigation()` — named to avoid confusion with TanStack Router's own `useNavigate`. Features never read it: they report user actions through callback props, and their view wires those to the navigation object.

The full target interface, as in the design:

```ts
interface Navigation {
  openHome(options?: NavigationOptions): void;
  openEntityItemCollection(entityName: string, options?: NavigationOptions): void;
  openItem(entityName: string, id: string, options?: NavigationOptions): void;
  openClassifyCreate(options?: NavigationOptions): void;
  openEditItem(entityName: string, id: string, options?: NavigationOptions): void;
  openCreateItem(entityName: string, options?: NavigationOptions): void;
  openSettings(options?: NavigationOptions): void;
}

interface NavigationOptions {
  /** Open the destination in a new browser tab instead of the current one. Default `false`. */
  openInNewTab?: boolean;
}
```

The set may be extended. The functions are implemented page by page, so the interface is not complete from the start:

| Function                                           | Exists from                                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `openHome`, `openEntityItemCollection`, `openItem` | PR 2 (the scaffold), needed through PR 3                                                                                                      |
| `openCreateItem`                                   | PR 3 — the item detail view wires it to the relation popover's existing "create missing target" callback (no separate prop added on the view) |
| `openClassifyCreate`                               | PR 5 — the sidebar's "Create Item" (T041)                                                                                                     |
| `openSettings`                                     | PR 5 — an extension to the six functions: the user menu's "Settings" (T037)                                                                   |
| `openEditItem`                                     | The PR that adds the page using it (T041)                                                                                                     |

The item detail view's relation popover already reports "create missing target" through the feature's own `onRelationItemCreateNew` callback prop. The view wires that callback straight to `navigation.openCreateItem(targetEntityName)` itself; it does not re-expose a separate `onRelationItemCreateNew` (or similarly named) prop upward to its own caller. For the "create missing target" action the view passes `{ openInNewTab: true }`, which keeps today's new-tab behaviour (open question 6, resolved by this option).

## Rules

1. **The caller does not care what happens next.** The app changes the route; the chat may open Navigator; a split view changes a pane.
2. **`openEntityItemCollection` restores the list as the user left it** (filters, sort order, page). Today the list breadcrumb does this from a session memo in the query cache; the app's implementation keeps doing that, so views need not know how.
3. **Only views call it; no router in views or features.** Every click that opens something, including the view's own toolbar breadcrumbs and a click that comes from a feature (reported through a callback prop), is turned by the view into a call on the navigation object. Host code in `packages/views/src/shells/` (router setup only) and the apps — including each app's own `Navigation` implementation, a file under that app's own `src/routes/` (not `packages/views/src/shells/`; see `research.md` §2.7) — MAY use the router.
4. **One-page-only actions stay props.** For example "after create, go to the new item" remains a normal prop.
5. **A missing provider is a development-time error**, not a silent no-op.
6. **Children get their own navigation.** A parent view wraps each child in its own provider. When the child calls `openItem`, the parent decides: for the list in a split view it shows that item in the other pane and does not call the route. Children do not know they are side by side.
7. **Guarding leaving is open.** A function to guard leaving with unsaved changes is proposed (open question 3) and is not part of this contract yet.
8. **Every `open*` takes the same optional options object.** `openInNewTab` defaults to `false`. The view decides it, for example from a feature callback, or because the action is "create missing related item", which keeps today's new-tab behaviour by passing `{ openInNewTab: true }` to `openCreateItem`. A host that cannot open tabs (chat panel, split view parent) MAY treat it as a hint.

## Hosts

| Host                | Implementation                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| App                 | Route changes through the router; `openEntityItemCollection` restores the list |
| Chat panel          | Its own version, for example "open in Navigator"                               |
| Storybook and tests | A recording fake that stores each call, shipped by `packages/views`            |
| Split view (parent) | Per-child objects that change a pane instead of the route                      |

## Test obligations

- The recording fake records calls in order with their arguments, including the options argument.
- A view calls the navigation object, and never the router, for every clickable breadcrumb and action (FR-023).
