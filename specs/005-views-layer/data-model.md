# Data Model: Views Layer

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The feature persists nothing on the server. This describes the shapes that cross layer boundaries. Platform objects (`ProfileEntity`, `EntityItem`, `EntityItemCollection`) are the existing `@contentgrid/navigator-data` accessors and are not redefined.

## ViewTarget

What a view shows. Defined in `packages/views`. Contract: [view-target.md](contracts/view-target.md).

```ts
type ViewTarget =
  | { kind: "name"; entityName: string; itemId?: string }
  | { kind: "url"; href: string }; // HAL URL, e.g. from the chat backend
```

| Variant | Fields                          | Meaning                                                                             |
| ------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `name`  | `entityName`, optional `itemId` | The entity's profile name; with `itemId` an item, without it the collection         |
| `url`   | `href`                          | A link from the API (self link of an item or collection, or a link from a response) |

**Rules**

- `entityName` is the profile name, never the plural path. The collection address comes from the profile (`profileEntity.collectionUrl`), the item address from `profileEntity.itemUrl(id)`.
- `itemId` is the item's `id` field; it is never read out of a link.
- A `ViewTarget` carries no filters, sort or page (FR-011).

## ResolvedViewTarget

What the data layer returns once per view start. Contract: [view-target.md](contracts/view-target.md).

| Field           | Type                                        | Notes                                          |
| --------------- | ------------------------------------------- | ---------------------------------------------- |
| `profileEntity` | `ProfileEntity`                             | Always present on success                      |
| `entityItem`    | `EntityItem` (item targets only)            | Present when the target addresses an item      |
| `collection`    | collection source (collection targets only) | Present when the target addresses a collection |

The exact member names are finalised in PR 3; the rule is that a view never sees whether the input was a name or a link.

**Cache key**: the item's own self link (FR-010). A name target and a link target for the same item resolve to the same key.

## ViewProps and view state

Contract: [view-props-and-state.md](contracts/view-props-and-state.md).

```ts
interface ViewProps<S = never> {
  target: ViewTarget;
  state?: S;
  onStateChange?: (state: S) => void;
}
```

Each view defines its own `S`. Without `onStateChange` the view keeps `S` itself; with it, the host owns `S`.

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

Provided by the host through context. Contract: [navigation-context.md](contracts/navigation-context.md).

| Function                               | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `openHome()`                           | The home page                                                |
| `openEntityItemCollection(entityName)` | The list of an entity, restored as the user left it (FR-018) |
| `openItem(entityName, id)`             | One item                                                     |
| `openClassifyCreate()`                 | The general create page (arrives with the page that uses it) |
| `openEditItem(entityName, id)`         | An item's edit form (arrives with the page that uses it)     |
| `openCreateItem(entityName)`           | An entity's create form (arrives with the page that uses it) |

## Preload signature

Contract: [view-preload.md](contracts/view-preload.md).

```ts
type ViewPreload<S> = (ctx: AppRouterContext, target: ViewTarget, state?: S) => Promise<void>;
```

`ctx` is the router context: the query client and the API client. A preload never throws to the route (it swallows failures as `ensureEntityItemDetailLoaderData` does today) and never loads data the view would not need.

## Display preferences (moves to navigator-data)

The `EntityDisplayPreferences` type and the backend part already live in `@contentgrid/navigator-data`. After PR 9 the merge, the hook and the store live there too.

| Layer (highest first) | Source                                                  | Notes                                                   |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| User override         | Store created by the app, saved in configurable storage | Keyed by profile URL and entity name; per-field partial |
| Backend               | Loaded with the query client                            | Returns nothing until the backend API exists            |
| Default               | Worked out from the profile                             | Icon, name attribute, columns                           |

**Storage**: the app creates the store at startup with a storage option; local storage is the default. The persisted key stays `contentgrid-entity-display-preferences` so existing user choices keep working.

## Stability tag

Today: `x-stability` in each feature directory's `package.json`. After PR 10: `x-stability` in each view's `package.json`; features carry none. Values stay `experimental | candidate | stable`.
