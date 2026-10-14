# Contract: view props and state

**Requirements**: FR-002, FR-011, FR-012, FR-013, FR-014, FR-015
**Package**: `packages/views`

## Props

Each view declares its own explicit props — there is no generic `ViewProps<S>` or `ViewTarget` type every view extends. A view that shows an item takes a plain id (or, once a host needs it, a link); reading the view's own prop list tells you what it needs, without looking anywhere else. In this stack:

```ts
interface EntityItemDetailViewProps {
  entityName: string;
  itemId: string;
  toolbar?: boolean;
}

interface EntityItemCollectionViewProps {
  entityName: string;
  toolbar?: boolean;
  state?: CollectionViewState;
  onStateChange?: (state: CollectionViewState) => void;
}
```

A link-based prop (for example `itemUrl`) is deferred until the chat integration needs it (User Story 3, FR-008). When a view adds one, it is that view's own explicit prop, resolved through `navigator-data`'s existing hooks — not a shared target type.

## Rules

1. **Explicit props per view, not a shared target type.** A view declares the props it needs (an entity name and an item id, or whatever else identifies what it shows). There is no abstraction every view must extend to be given one; a reviewer reads the view's own prop list, not a generic type.
2. **The one thing views share is the toolbar switch.** `toolbar?: boolean` (default on) is the generic, reusable part — see [view-toolbar.md](view-toolbar.md). Nothing else about a view's props is standardised.
3. **Controlled or internal state.** A view that has state accepts an optional `state` and `onStateChange`. With `onStateChange`, the host owns the state: the view renders `state` and reports every change. Without it, the view keeps the state itself, starting from `state` if given.
4. **The chat passes `state` directly**, or nothing. When nothing is passed, the view is expected to still function correctly. It always has its own internal state that keeps functioning, even if nothing is passed.
5. **The view defines its own state type.** The host treats it as plain data and never reads inside a state shape it did not define.
6. **The app owns the address.** The app reads its address into `state` and writes `onStateChange` back to the address. It is the only layer that knows the address format. A frontend address is never passed as one of a view's identifying props.
7. **Plain values only.** Identifying props and state are serialisable plain data: strings, numbers, booleans, arrays and records of them. No domain objects, no functions (other than the callback props themselves).
8. **Parents prefix children.** A parent view stores each child's state under the child's own key (see [data-model.md](../data-model.md#composite-view-state-split-views)). The address scheme is open question 2.

## Collection view state

See [data-model.md](../data-model.md#collection-view-state). Filter keys are the search template's field names; the view turns state into a request through `searchTemplate`. The page value is the opaque page key; it is never decoded.

## What the app may still do

- Validate the address into state (for example with the search-state helpers that exist today, until they move into the view).
- Keep a session memo of the last state per entity, so the list breadcrumb restores filters, sort and page (see [navigation-context.md](navigation-context.md)). The memo is part of the app's `openEntityItemCollection`, not of the view.

## Test obligations

- A view renders the same with `state` given and no `onStateChange` as a controlled view with the same state.
- A view renders correctly with neither `state` nor `onStateChange` passed, keeping its own internal state.
- A change in the view calls `onStateChange` exactly once with the full next state.
- A state key the profile no longer has is ignored.
