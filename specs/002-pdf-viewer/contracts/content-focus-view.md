# Contract: `EntityItemContentFocusView` (`@contentgrid/features/entity-item-content-focus`)

Follows the spec-001 feature-view contract: identifiers and callbacks in, data resolved inside.

```ts
export interface EntityItemContentFocusViewProps {
  readonly entityName: string; // profile entity name from the route
  readonly itemId: string;
  readonly toolbar?: ViewToolbarConfiguration; // { breadcrumbs?, actions? } | false | undefined
  readonly onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
  readonly onMissingRelationTargetClick?: (missingItemUrl: string) => void;
  readonly onBlindRelationOverwriteClick?: (existingRelationUrl: string) => void;
  readonly onRequiredRelationClick?: (referencingItemUrl: string) => void;
}
```

## Responsibilities

- Resolve `profileEntity` with `useProfileEntity({ name })` and the item with `useEntityItem`; the app's
  `/$entity` gate guarantees the profile is loaded before mount; the view still handles the item's own
  pending/error states (component-level, not a second page gate).
- FR-001: if `profileEntity.hasContentAttributes` is false, render the existing `EntityItemView` body
  (attribute-focus); otherwise render `ContentFocusLayout` with the preview on the left and the side
  panel (existing `EntityItemAttributes` + relation sections) on the right.
- Default breadcrumbs/title derived from the profile and item; overridable via `toolbar`.
- Select the default content attribute (data-model rules); expose the selector whenever the item has
  more than one content attribute at all — not only ones that currently hold a file, so a user can
  still switch to/from an attribute that needs a file uploaded or that errors out while loading
  (round-2 review of #192). The selector stays visible in every content-preview state, not only
  once a PDF viewer is actually mounted.

## Components (feature-local)

- `ContentFocusLayout` — `grid-template-columns: 1fr 360px`, side panel collapsible, fills height
  (FR-015), hosts fullscreen.
- `ContentPreviewPanel({ entityItem, attributeName, toolbarStart? })` — owns `useContentPreview` and
  `useDownloadContent`; lazy-loads `PdfViewer`; converts `PreviewSource` + viewer callbacks into the
  FR-024 state; Download delivers the original bytes via an object URL and revokes it. `toolbarStart`
  is the view's `ContentAttributeSelector` node — the panel has no attribute-selection logic of its
  own; it forwards that node into the mounted `PdfViewer`'s toolbar `start` slot for the `ready`
  state, and into `ContentPreviewFrame`'s own `toolbarStart` (a small header bar above the state
  body) for every other state, so the selector never disappears (round-2 review of #192).
- `ContentPreviewFrame` — presentational: `state` prop → skeleton / message / drop zone / viewer; every
  state has a story. Accepts an optional `toolbarStart` node, rendered in a header bar above the
  state body for every state except `ready` (whose mounted viewer already carries it). The "No file"
  state renders `@contentgrid/ui`'s `FileUploadZone` with a feature-supplied `onFileChange` that is a
  no-op until the content-upload story wires it.

## Host (app) responsibilities

- `apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx` mounts the view with
  `entityName`, `itemId`, and navigation callbacks only — it passes no `toolbar` override, so the
  view's own default breadcrumbs (Home → `profileEntity.pluralName` → item id) render as-is; the
  route only needs `toolbar` when it wants different chrome.
- Provide CSP: `worker-src blob:`; `connect-src` includes the rendition origin; `script-src` unchanged
  (the wasm is fetched, not inlined).

## Promotion

Flip `x-stability` to `candidate`/`stable` only after: stories green (visual + a11y), e2e green,
rendition contract confirmed (ACC-2960), and the FR-001 branch moved into `entity-item`'s
`EntityItemView` so that `apps/navigator` needs no route change.
