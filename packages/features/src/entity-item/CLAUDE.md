# packages/features/src/entity-item — CLAUDE.md

Feature: `entity-item` · `x-stability: "stable"` — mounted by both apps through
`@contentgrid/views/entity-item-detail`.

Renders one already-loaded entity item: its attributes, relations and (when it has them) content.
The view above owns the item query and passes the loaded item plus its `refetch`. No component here
draws a toolbar or page chrome (see "Page layout" in `packages/features/CLAUDE.md`).

## Layout

```
use-entity-item-context.ts   item context hook (item, refetch, edit mode)
entity-item-sections.tsx     attributes, relations and audit trail as collapsible sections
attributes/                  attribute list, editable attributes, value renderers
relations/                   to-one / to-many relation sections, relation picker
edit/                        edit button, update form
variations/
  entity-item-variation-props.ts   props every variation takes
  entity-item-auto-variation.tsx   picks and renders a variation
  entity-item-relation-summary.tsx relation titles and counts under the item's title
  attribute-focus/   EntityItemAttributeFocus — sections in one card
  content-focus/     EntityItemContentFocus — content preview + sections side panel
  attribute-summary/ EntityItemAttributeSummary — compact label/value grid (relation cards)
  item-reference/    EntityItemReference — icon, title, subtitle row
```

## Variations

`EntityItemAutoVariation` is what the view mounts. It takes `entityItem`, an optional
`variation` (`"auto"` by default) and everything in `EntityItemVariationProps` except `item`. For
`"auto"` it renders `content-focus` when the entity has content attributes and `attribute-focus`
otherwise (FR-001), unless the entity's `itemLayout` display preference (`~configuration/$entity`)
is `"stacked"` or `"columns"` rather than `"content"`: then it renders `attribute-focus`, where
`"stacked"` lists every section in one card and `"columns"` moves the relations into a fixed-width
column of cards next to the card with the attributes and audit trail (below it in a narrow
container). `"content"` is the default, and only an option,
for an entity with content attributes; without one the default is `"stacked"`.
`resolveEntityItemVariation()` tells you which variation renders. `useEntityItemDetailPadding()`
(or `entityItemDetailPadding()` given the `itemLayout`) gives the view the matching page padding
(content focus runs edge to edge).

Every variation takes `EntityItemVariationProps`:

- `item` — the loaded item (its profile is `item.profileEntity`)
- `refetch` — reloads the item (optional)
- `onRelationItemClick`, `onRelationItemCreateNew` and the relation problem handlers
- `actions` — extra nodes drawn next to the edit button
- `allowEdit` — show the edit button (default `true`)

### Adding a variation

1. Create `variations/<name>/entity-item-<name>.tsx` exporting `EntityItem<Name>`, typed
   `Readonly<EntityItemVariationProps>`. Root `h-full min-h-0`, no outer padding.
2. Call `useEntityItemContext(item, refetch)` for edit mode, render `actions` next to
   `EditEntityItemButton`, and render that button only when `allowEdit` is true.
3. Register it in `ENTITY_ITEM_VARIATIONS` in `entity-item-auto-variation.tsx` (the
   `satisfies` check fails if its props don't match). Update `resolveEntityItemVariation` if
   `"auto"` should pick it.
4. Export it from `index.ts` if apps or views need it directly.

## Item context

`useEntityItemContext(item, refetch)` (`use-entity-item-context.ts`) is what a variation calls for
the shown item. It returns:

- `item`, `refetch` — passed through
- `shownItem` — the version being edited while the form is open, `item` otherwise; pass this to
  `EditableEntityItemAttributes`
- `isEditing`, `setIsEditing` — edit mode; it ends when the item changes and stays closed when the
  page comes back to it
- `refresh` — refetches and moves the open form onto the latest version (the form's Refresh after
  a 412)

While editing, a background refetch does not change `shownItem`, so the user's input stays and a
save of a stale version is refused (412). `noRefetch` is the default when the caller can't reload.

## Rules

- Imports: `@contentgrid/ui`, `@contentgrid/navigator-data`, `../../hal-forms`,
  `../../problem-details`, `../../unsaved-changes-guard`, `../../layout` (`RightSidePanelLayout`).
  Never a Layer-1 `@contentgrid/*` package.
- Variations receive the loaded item and callbacks only — no toolbar, breadcrumb or link render
  props, and no navigation of their own (ADR-018).
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
