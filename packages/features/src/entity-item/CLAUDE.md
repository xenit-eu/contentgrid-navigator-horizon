# packages/features/src/entity-item — CLAUDE.md

Feature: `entity-item` · `x-stability: "stable"` — mounted by both apps through
`@contentgrid/views/entity-item-detail`.

Renders one already-loaded entity item: its attributes, relations and (when it has them) content.
The view above owns the item query and passes the loaded item plus its `refetch`. No component here
draws a toolbar or page chrome (see "Page layout" in `packages/features/CLAUDE.md`).

## Layout

```
use-entity-item-context.ts   item context hook (item, refetch, edit mode, section state)
use-entity-item-section-props.ts  EntityItemSections props for a variation
entity-item-sections.tsx     attributes, relations and audit trail as collapsible sections
content-attribute-metadata.ts  a content attribute's stored-file metadata, read off the item
attributes/                  attribute list, editable attributes, value renderers
relations/                   to-one / to-many relation sections, relation picker, relation summary
edit/                        edit button, update form
variations/
  entity-item-variation-props.ts   props every variation takes
  entity-item-auto-variation.tsx   picks and renders a variation
  attribute-focus/   EntityItemAttributeFocus — sections in one card, with relation summary
  content-focus/     EntityItemContentFocus — content preview + sections side panel
  side-by-side/      EntityItemSideBySide — attributes card + resizable column of relation cards
  item-card/         EntityItemCard — the card attribute-focus and side-by-side share
  attribute-summary/ EntityItemAttributeSummary — compact label/value grid (relation cards)
  item-reference/    EntityItemReference — icon, title, subtitle row
```

## Variations

`EntityItemAutoVariation` is what the view mounts. It takes `entityItem`, an optional
`variation` (`"auto"` by default) and everything in `EntityItemVariationProps` except `item`. For
`"auto"` the entity's `itemLayout` display preference (`~configuration/$entity`) picks the
variation:

- `"content"` → `content-focus` (only an option, and the default, for an entity with content
  attributes; FR-001)
- `"stacked"` → `attribute-focus`: every section in one card, with the relation summary under the
  item's title (the default without content attributes)
- `"columns"` → `side-by-side`: the attributes and audit trail in a card, the relations in a
  column of cards next to it, split by a draggable handle (`ResizableSplitLayout`). In a narrow
  container the panes stack without a handle (`resizableStacked={false}`). Side by side, each pane scrolls on its own and the relations adapt to their pane's width;
  no relation summary

`resolveEntityItemVariation()` tells you which variation renders. `useEntityItemDetailPadding()`
(or `entityItemDetailPadding()` given the `itemLayout`) gives the view the matching page padding
(content focus runs edge to edge).

Every variation takes `EntityItemVariationProps`:

- `item` — the loaded item (its profile is `item.profileEntity`)
- `refetch` — reloads the item (optional)
- `onRelationItemClick`, `onRelationItemCreateNew` and the relation problem handlers
- `actions` — extra nodes drawn next to the edit button
- `allowEdit` — show the edit button (default `true`)
- `onDeleted` — draw an icon-only Delete next to Edit (hidden while editing); the caller decides
  where to go after a delete. The view passes it only when it has no toolbar to put Delete in.
- `onEditingChange` — hears edit mode open and close, so the view can hide its toolbar Delete
  while the edit form is open

### Adding a variation

1. Create `variations/<name>/entity-item-<name>.tsx` exporting `EntityItem<Name>`, typed
   `Readonly<EntityItemVariationProps>`. Root `h-full min-h-0`, no outer padding.
2. Call `useEntityItemContext(item, refetch, onEditingChange)` for edit mode, render `actions`
   next to `EditEntityItemButton`, and render that button only when `allowEdit` is true. When
   `onDeleted` is passed, render `DeleteEntityItemButton` after it, hidden while editing.
3. Register it in `ENTITY_ITEM_VARIATIONS` in `entity-item-auto-variation.tsx` (the
   `satisfies` check fails if its props don't match). Update `resolveEntityItemVariation` if
   `"auto"` should pick it.
4. Export it from `index.ts` if apps or views need it directly.

## Item context

`useEntityItemContext(item, refetch)` (`use-entity-item-context.ts`) is what a variation calls for
the shown item. It returns:

- `item`, `refetch` — passed through
- `shownItem` — while editing, the version the edit form was opened on; `item` otherwise. Pass this
  to `EditableEntityItemAttributes`
- `isEditing`, `setIsEditing` — edit mode; it ends when the item changes and stays closed when the
  page comes back to it
- `refresh` — refetches and moves the edit form onto the latest version (the form's Refresh after
  a 412)
- `sections` — open/closed state of the collapsible sections; pass it to `EntityItemSections` as
  `state`, and use its `revealRelation` to expand and scroll to a relation (the relation summary)
  — toggles last while the page stays on the item; on another item every section is back at its
  default (`defaultSectionOpen` in `entity-item-sections.tsx`)
- `pendingContent`, `setPendingContent` — the file changes made in the edit form and not saved yet,
  per content attribute: a new file to store, or `null` to remove the stored one. Save sends them
  after the other fields are saved.
  - Why here and not in the form: the content preview next to the form needs them too. It shows a
    picked file before it is uploaded, and a drop zone when there is no file (removed, or none
    stored); a file dropped there is added to the same list (`withContentChange`).
  - When the list is emptied: on opening or closing the edit form (saved or cancelled), and on
    moving to another item. `refresh` (after a 412) keeps it, so the user can save again without
    picking the files again.
- `contentFailures`, `setContentFailures` — the message of each file change the last Save could not
  apply, by attribute name; the form shows it on that attribute's card (`FileRenderer`'s `error`).
  - Why here and not in the form: the form remounts when the refresh after a failure lands (new
    ETag), and the failure has to outlive that.
  - When an entry goes: when the user changes that attribute's file again (`setPendingContent`
    drops the failures of the attributes it changes, whether the change comes from the form or the
    content preview's drop zone), when a new Save starts (the form clears them, then sets the new
    Save's), on opening or closing the form and on moving to another item. `refresh` keeps them.
- `isSaving`, `setIsSaving` — whether the edit form is saving; the form reports it through
  `onSavingChange`. While it is true the file fields and the content preview's drop zone take no
  file, and the form's Cancel does nothing. Cleared together with `pendingContent`.

While editing, a background refetch does not change `shownItem`, so the user's input stays and a
save of a stale version is refused (412). `noRefetch` is the default when the caller can't reload.

## Rules

- Imports: `@contentgrid/ui`, `@contentgrid/navigator-data`, `../../hal-forms`,
  `../../problem-details`, `../../unsaved-changes-guard`, `../../layout` (`RightSidePanelLayout`),
  `../../entity-item-delete` (`DeleteEntityItemButton`).
  Never a Layer-1 `@contentgrid/*` package.
- Variations receive the loaded item and callbacks only — no toolbar, breadcrumb or link render
  props, and no navigation of their own (ADR-018).
- `entity-item-create` previews a picked file with `FilePreview`, `ContentPreviewFrame` and
  `ContentAttributeOptionSelector`, imported from this feature's `index.ts` — never from
  `variations/content-focus/` directly.
- `variations/content-focus/util/` stays pure: no `useQuery`, no JSX, no `@contentgrid/ui`.

## Content focus deployment requirements

Carried by any app that mounts the content-focus variation (spec `002-pdf-viewer`):

- **CSP** — `worker-src blob:` (PDFium worker), `img-src blob:` and `media-src blob:` (stored
  images/videos), and `connect-src` including the rendition service origin when `renditionUri` is
  set.
- **No CDN** — the PDFium WASM binary is self-hosted (`util/pdfium-wasm-url.ts`).
- **Rendition service CORS** — allow the Navigator origin, accept the content download
  `Authorization` header, and expose the `Location` response header (the `202`'s job URL).
- **Liaison delivers `v1.renditionUri`** in `config.js`; without it renditions are silently
  unavailable (`useContentPreview` → `{ kind: "unavailable" }`).
- **Not settled until ACC-2960 closes** — the rendition response contract (`202` + `Location` →
  poll → `200`/`invalid-conversion`/error) and the CORS requirements above are assumptions pending
  platform confirmation.
