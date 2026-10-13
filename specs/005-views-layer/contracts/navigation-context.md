# Contract: navigation context

**Requirements**: FR-016, FR-017, FR-018, FR-019, FR-020, FR-026
**Package**: `packages/views` (context, provider, hook, recording fake); implementations live in the hosts

## Shape

The host provides one navigation object through React context. Views and features read it with `useNavigation()`.

```ts
interface Navigation {
  openHome(): void;
  openEntityItemCollection(entityName: string): void;
  openItem(entityName: string, id: string): void;
  // Added when the page that uses them lands:
  openClassifyCreate(): void;
  openEditItem(entityName: string, id: string): void;
  openCreateItem(entityName: string): void;
  // Optional; see "hrefFor" below.
  hrefFor?: {
    home(): string;
    entityItemCollection(entityName: string): string;
    item(entityName: string, id: string): string;
  };
}
```

The design lists these six and says the set may be extended. The first PRs only need `openHome`, `openEntityItemCollection` and `openItem`; the others arrive with the pages that use them.

### `hrefFor`

Optional, one entry per `open*` the host has a real address for. When present, a view renders a real
`<a href>` for that action instead of a `<button>` (component `NavigationLink`, `packages/views/src/navigation/`)
— so cmd/middle-click, "copy link" and screen-reader link semantics work — while a plain, unmodified
left click still goes through the matching `open*` function instead of the browser. A host with
nothing to link to (chat panel, a split-view pane) simply omits it. `ChildNavigationProvider` passes
the parent's `hrefFor` through unless a child explicitly overrides it; `createRecordingNavigation`
gives deterministic hrefs (`/`, `/{entityName}`, `/{entityName}/{id}`) for stories and tests.

| Host                | `hrefFor`                                                                   |
| ------------------- | --------------------------------------------------------------------------- |
| App                 | `router.buildLocation({ ...same to/params/search as the open* call }).href` |
| Chat panel          | Absent — nothing to link to                                                 |
| Storybook and tests | Deterministic fake paths from `createRecordingNavigation`                   |
| Split view (parent) | The parent's own `hrefFor`, passed through unless a child overrides it      |

## Rules

1. **The caller does not care what happens next.** The app changes the route; the chat may open Navigator; a split view changes a pane.
2. **`openEntityItemCollection` restores the list as the user left it** (filters, sort order, page). Today the list breadcrumb does this from a session memo in the query cache; the app's implementation keeps doing that, so views need not know how.
3. **No router in views or features.** Every click that opens something, including the view's own toolbar breadcrumbs, calls the navigation object.
4. **One-page-only actions stay props.** For example "after create, go to the new item" remains a normal prop.
5. **A missing provider is a development-time error**, not a silent no-op.
6. **Children get their own navigation.** A parent view wraps each child in its own provider. When the child calls `openItem`, the parent decides: for the list in a split view it shows that item in the other pane and does not call the route. Children do not know they are side by side.
7. **Guarding leaving is open.** A function to guard leaving with unsaved changes is proposed (open question 3) and is not part of this contract yet.

## Hosts

_As built (PR 4):_ the app's implementation is `RouterNavigationProvider`, `packages/views/src/shells/router-navigation-provider.tsx` (`./shells` export, not the package's main export — the one place outside `apps/*` allowed to import `@tanstack/react-router`), mounted in each app's root route. Moved here from each app's own `src/app-navigation.tsx` during PR 4 review, ahead of the rest of `packages/features/src/shells/` which still moves with PR 7.

| Host                | Implementation                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| App                 | Route changes through the router; `openEntityItemCollection` restores the list |
| Chat panel          | Its own version, for example "open in Navigator"                               |
| Storybook and tests | A recording fake that stores each call, shipped by `packages/views`            |
| Split view (parent) | Per-child objects that change a pane instead of the route                      |

## Test obligations

- The recording fake records calls in order with their arguments.
- A view calls the navigation object, and never the router, for every clickable breadcrumb and action (FR-023).
