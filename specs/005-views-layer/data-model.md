# Data Model: Views Layer

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The feature persists nothing on the server. This describes the shapes that cross layer boundaries. Platform objects (`ProfileEntity`, `EntityItem`, `EntityItemCollection`) are the existing `@contentgrid/navigator-data` accessors and are not redefined.

There is no shared `ViewTarget`/`ResolvedViewTarget` type and no generic `ViewProps<S>`/`ViewPreload<S>` type. Each view declares its own explicit props, state and preload signature; the only thing views share is the toolbar on/off switch (see [view-toolbar.md](contracts/view-toolbar.md)).

## View props

What a view shows, as the view's own props. Contract: [view-props-and-state.md](contracts/view-props-and-state.md).

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

| Field        | Meaning                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityName` | The profile name, never the plural path. The collection address comes from the profile (`profileEntity.collectionUrl`), the item address from `profileEntity.itemUrl(id)`. |
| `itemId`     | The item's `id` field; it is never read out of a link.                                                                                                                     |
| `toolbar`    | Default on. The one prop every view that draws a toolbar shares (FR-024).                                                                                                  |

**Deferred**: a link-based prop (for example `itemUrl`) for the item detail view, so a host such as the chat assistant can open it from an API link instead of an entity name and item id. Not a requirement now (FR-008); when a view adds one, it resolves the link itself through `navigator-data`'s existing hooks — there is no shared target-resolution mechanism to build first.

## View state

Contract: [view-props-and-state.md](contracts/view-props-and-state.md).

Each view defines its own state type and takes it the same way: an optional `state` and an optional `onStateChange`. Without `onStateChange` the view keeps its state itself; the item detail view above has no state of its own yet, so it has neither prop.

### Collection view state

```ts
interface CollectionViewState {
  filters: Record<string, string>; // keys = search template field names
  sort?: string; // as produced by the search template's sort options
  page?: string; // opaque cursor key
}
```

**Rules**

- Filter keys are field names of `profileEntity.searchTemplate`; the view builds the request through the template (FR-014).
- `page` is the opaque key from the existing cursor-registry pattern. It is never decoded, and no address is built from it (constitution Principle I).
- An empty `filters` and no `sort` or `page` is the default state.
- Keys that the profile no longer has are ignored.

### Composite view state (split views)

A parent view's state holds each child's state under that child's own key, so panes do not overwrite each other: `{ [childKey]: ChildState }`. How the app writes this to the address is open question 2.

## Navigation object

Provided by the host through context; only views read it, features get callback props. The set may be extended; the functions are implemented page by page. Contract: [navigation-context.md](contracts/navigation-context.md).

| Function                               | Purpose                                                      | Exists from                                                                                              |
| -------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `openHome()`                           | The home page                                                | PR 2, needed through PR 5                                                                                |
| `openEntityItemCollection(entityName)` | The list of an entity, restored as the user left it (FR-018) | PR 2, needed through PR 5                                                                                |
| `openItem(entityName, id)`             | One item                                                     | PR 2, needed through PR 5                                                                                |
| `openCreateItem(entityName)`           | An entity's create form                                      | PR 3 — the item detail view wires its relation popover's existing "create missing target" callback to it |
| `openClassifyCreate()`                 | The general create page                                      | Arrives with the page that uses it                                                                       |
| `openEditItem(entityName, id)`         | An item's edit form                                          | Arrives with the page that uses it                                                                       |

## Preload signature

Contract: [view-preload.md](contracts/view-preload.md).

Each view's preload takes exactly that view's own props, not a shared `target`/`state` tuple, and is named `preload<ViewName>`:

```ts
function preloadEntityItemDetail(
  ctx: AppRouterContext,
  entityName: string,
  itemId: string,
): Promise<void>;
```

`ctx` is the router context: the query client and the API client. A preload is a thin wrapper around the query client's `ensureQueryData(...)`, called with the same `navigator-data` query factories the view's own hooks use — no new query keys. A preload never throws to the route (it swallows failures as `ensureEntityItemDetailLoaderData` does today) and never loads data the view would not need.

## Display preferences (move to a user-preferences feature)

The `EntityDisplayPreferences` type and the backend part already live in `@contentgrid/navigator-data` and stay there unchanged. The merge logic, the hook and the store move into their own feature in `packages/features` (`user-preferences`), not into `navigator-data` — other features already import one another (e.g. every HAL-Forms-driven form goes through the `hal-forms` feature), so a shared feature is enough; it does not need to live in the data layer. This also means no new peer dependency: `packages/features` already depends on Zustand, so open question 4(d) (a Zustand peer dependency in `navigator-data`) does not arise.

| Layer (highest first) | Source                                                  | Notes                                                   |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| User override         | Store created by the app, saved in configurable storage | Keyed by profile URL and entity name; per-field partial |
| Backend               | Loaded with the query client, from `navigator-data`     | Returns nothing until the backend API exists            |
| Default               | Worked out from the profile                             | Icon, name attribute, columns                           |

**Storage**: the app creates the store at startup with a storage option; local storage is the default. The persisted key stays `contentgrid-entity-display-preferences` so existing user choices keep working.

## Stability tag

Today: `x-stability` in each feature directory's `package.json`. After PR 9: `x-stability` in each view's `package.json`; features carry none. Values stay `experimental | candidate | stable`.
