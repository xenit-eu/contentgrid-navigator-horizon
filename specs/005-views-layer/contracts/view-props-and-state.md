# Contract: ViewProps and view state

**Requirements**: FR-002, FR-011, FR-012, FR-013, FR-014, FR-015
**Package**: `packages/views`

## Props

```ts
interface ViewProps<S = never> {
  target: ViewTarget;
  state?: S;
  onStateChange?: (state: S) => void;
}
```

A view that has state extends `ViewProps<ItsState>` with its own props, for example a way to turn its toolbar off (see [view-toolbar.md](view-toolbar.md)).

## Rules

1. **Controlled or internal.** With `onStateChange`, the host owns the state: the view renders `state` and reports every change. Without it, the view keeps the state itself, starting from `state` if given.
2. **The view defines `S`.** The host treats it as plain data. A host never reads inside a state it did not define.
3. **The app owns the address.** The app reads its address into `state` and writes `onStateChange` back to the address. It is the only layer that knows the address format. A frontend address is never a target.
4. **The chat passes `state` directly**, or nothing.
5. **Plain values only.** State is serialisable plain data: strings, numbers, booleans, arrays and records of them. No domain objects, no functions.
6. **Parents prefix children.** A parent view stores each child's state under the child's own key (see [data-model.md](../data-model.md#composite-view-state-split-views)). The address scheme is open question 2.

## Collection view state

See [data-model.md](../data-model.md#collection-view-state). Filter keys are the search template's field names; the view turns state into a request through `searchTemplate`. The page value is the opaque page key; it is never decoded.

## What the app may still do

- Validate the address into state (for example with the search-state helpers that exist today, until they move into the view).
- Keep a session memo of the last state per entity, so the list breadcrumb restores filters, sort and page (see [navigation-context.md](navigation-context.md)). The memo is part of the app's `openEntityItemCollection`, not of the view.

## Test obligations

- A view renders the same with `state` given and no `onStateChange` as a controlled view with the same state.
- A change in the view calls `onStateChange` exactly once with the full next state.
- A state key the profile no longer has is ignored.
