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
- Select the default content attribute (data-model rules); expose the selector in the viewer toolbar
  `start` slot when more than one content attribute holds a file.

## Components (feature-local)

- `ContentFocusLayout` — `grid-template-columns: 1fr 360px`, side panel collapsible, fills height
  (FR-015), hosts fullscreen.
- `ContentPreviewPanel({ entityItem, attributeName })` — owns `useContentPreview` and
  `useDownloadContent`; lazy-loads `PdfViewer`; converts `PreviewSource` + viewer callbacks into the
  FR-024 state; Download delivers the original bytes via an object URL and revokes it.
- `ContentPreviewFrame` — presentational: `state` prop → skeleton / message / drop zone / viewer; every
  state has a story. The "No file" state renders `@contentgrid/ui`'s `FileUploadZone` with a
  feature-supplied `onFileChange` that is a no-op until the content-upload story wires it.

## Host (app) responsibilities

- `apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx` mounts the view with
  `entityName`, `itemId`, breadcrumbs and navigation callbacks; nothing else.
- Provide CSP: `worker-src blob:`; `connect-src` includes the rendition origin; `script-src` unchanged
  (the wasm is fetched, not inlined).

## Promotion

Flip `x-stability` to `candidate`/`stable` only after: stories green (visual + a11y), e2e green,
rendition contract confirmed (ACC-2960), and the FR-001 branch moved into `entity-item`'s
`EntityItemView` so that `apps/navigator` needs no route change.
