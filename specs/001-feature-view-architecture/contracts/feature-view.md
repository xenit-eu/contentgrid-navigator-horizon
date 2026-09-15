# Contract: Feature View

## Host Inputs

A per-feature view accepts plain string identifiers, plain callbacks for navigation and completed
actions, and optional layout or toolbar configuration.

A view does not accept a resolved `ProfileEntity`, `EntityItem`, query result, router instance, or
application context object from its host.

## View Responsibilities

- Read its ready primary domain context through `@contentgrid/navigator-data` using the identifier.
- Derive default labels, breadcrumbs, titles, subtitles, and actions from that context.
- Compose domain-aware components and shared UI patterns.
- Report interactions leaving the view through explicit callbacks.
- Keep distinct callbacks for interactions with different unsaved-change semantics.

## Host Responsibilities

- Select the view and surrounding application layout.
- Supply identifiers and callbacks.
- Own the primary-context gate described in [data-loading.md](data-loading.md).
- Preserve route-specific search and navigation state.

## Toolbar Contract

```ts
export interface ViewToolbarOptions {
  readonly breadcrumbs?: ReactNode;
  readonly actions?: ReactNode;
}

export type ViewToolbarConfiguration = ViewToolbarOptions | false | undefined;
```

- `undefined` or `{}` uses every view default.
- One supplied field overrides only that region.
- Both fields supplied override both regions.
- `false` renders feature content without toolbar chrome.

## Compatibility

New and migrated views adopt this contract. Existing public package subpaths remain available until
their consumers migrate in separately scoped work.
