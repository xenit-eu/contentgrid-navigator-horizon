# Contract: navigation context

**Requirements**: FR-016, FR-017, FR-018, FR-019, FR-020, FR-026
**Package**: `packages/views` (context, provider, hook, recording fake); implementations live in the hosts

## Shape

The host provides one navigation object through React context. Only views read it, with `useNavigation()`. Features never read it: they report user actions through callback props, and their view wires those to the navigation object.

The full target interface, as in the design:

```ts
interface Navigation {
  openHome(): void;
  openEntityItemCollection(entityName: string): void;
  openItem(entityName: string, id: string): void;
  openClassifyCreate(): void;
  openEditItem(entityName: string, id: string): void;
  openCreateItem(entityName: string): void;
}
```

The set may be extended. The functions are implemented page by page, so the interface is not complete from the start:

| Function                                               | Exists from                               |
| ------------------------------------------------------ | ----------------------------------------- |
| `openHome`, `openEntityItemCollection`, `openItem`     | PR 2 (the scaffold), needed through PR 6  |
| `openClassifyCreate`, `openEditItem`, `openCreateItem` | The PR that adds the page using it (T041) |

## Rules

1. **The caller does not care what happens next.** The app changes the route; the chat may open Navigator; a split view changes a pane.
2. **`openEntityItemCollection` restores the list as the user left it** (filters, sort order, page). Today the list breadcrumb does this from a session memo in the query cache; the app's implementation keeps doing that, so views need not know how.
3. **Only views call it; no router in views or features.** Every click that opens something, including the view's own toolbar breadcrumbs and a click that comes from a feature (reported through a callback prop), is turned by the view into a call on the navigation object. Host code in `packages/views/src/shells/` (router setup, the app's navigation implementation) and the apps MAY use the router.
4. **One-page-only actions stay props.** For example "after create, go to the new item" remains a normal prop.
5. **A missing provider is a development-time error**, not a silent no-op.
6. **Children get their own navigation.** A parent view wraps each child in its own provider. When the child calls `openItem`, the parent decides: for the list in a split view it shows that item in the other pane and does not call the route. Children do not know they are side by side.
7. **Guarding leaving is open.** A function to guard leaving with unsaved changes is proposed (open question 3) and is not part of this contract yet.

## Hosts

| Host                | Implementation                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| App                 | Route changes through the router; `openEntityItemCollection` restores the list |
| Chat panel          | Its own version, for example "open in Navigator"                               |
| Storybook and tests | A recording fake that stores each call, shipped by `packages/views`            |
| Split view (parent) | Per-child objects that change a pane instead of the route                      |

## Test obligations

- The recording fake records calls in order with their arguments.
- A view calls the navigation object, and never the router, for every clickable breadcrumb and action (FR-023).
