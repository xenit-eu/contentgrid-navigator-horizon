# Implementation Plan: Item Preview in the Entity Collection

**Spec**: [`spec.md`](spec.md)

## Summary

`EntityItemCollectionBrowser` (`packages/features`) owns the preview; `EntityItemCollectionView` (`packages/views`) does not change. The pane is read-only and opens nothing, so the view has nothing to add. The view keeps passing `onEntityItemClick` as "open the item's page" (`navigation.openItem`). The row click stays inside the feature. The feature does not know whether the host can open a page: it shows View exactly when it is given `onEntityItemClick`. Through the view that is always, as `navigation.openItem` is always there; a host without item pages places the browser without the callback.

The browser keeps the previewed item's `id`, not the item object. On each render it looks that id up in the page the table shows (`collection.data.findById`), so the pane always shows the item as the list has it. A refetch after an edit elsewhere or a delete updates or removes it. The file follows too: an item from a list page has no ETag, so `useContentPreview` keys such an item's preview on its content metadata (name, size, type) instead, and a replaced file is downloaded again. A replacement with the same name, size and type goes unnoticed until the item is fetched on its own. When the id is not in the shown page, the browser clears it and the preview closes. This covers a filter, sort or page change and a delete here or elsewhere, so the table needs no delete callback. That is on purpose: after a delete from the row, the pane stays open until the refetched page is shown, a moment later, rather than closing through a second path. While a new page loads, the previous page stays shown (`keepPreviousData`), so the pane closes only once the new page is in.

The browser measures its own root with `useContainerWidthAtLeast(rootRef, "side-by-side")` (880 px, as in 006), so a split pane, the chat or the sidebar all count. In a wide view it renders the table and `EntityItemPreviewPane` in a `ResizableSplitLayout` whose right panel is always there, collapsed while nothing is previewed, so opening the pane never remounts the table. While it is collapsed the resize handle is hidden (`handleHidden`): no divider, no lost width, no separator for a screen reader. In a narrow view it renders the pane in a `Dialog`. The view crossing the width closes the preview.

The table's row click previews the row. Its View action calls a new `onEntityItemOpen`, which the browser wires to its own `onEntityItemClick`. Without it, View is not shown and rows still preview. With the default row actions, the table shows its actions column only when there is View or an item on the page can be deleted. `RecordTableRow` gains `current` (`aria-current="true"` plus the highlight), and its Enter/Space handler only acts on keys pressed on the row itself, not on its buttons or checkbox; Space on the row is `preventDefault`ed so the page does not scroll.

Focus: opening the pane leaves focus on the row. Closing it while focus is inside (tracked on the pane, not read from `document.activeElement` afterwards) returns focus to the previewed row, or, when that row is gone, to the region around the table (`tabIndex={-1}`). Escape closes the pane only when focus is inside it and the key was not handled by a control in the pane. Closing the pane from its resize handle hides the handle that had focus, so that path returns focus to the row too. The dialog's focus is set by hand as well: on open it goes to the dialog itself rather than its first button, and on close to the row, with the same fallback to the table's region. The dialog gets the item's name as its title, the same name the pane's region has, and keeps showing the last item while it animates closed. The row and header fills become opaque (`--table-row`, `--table-header`), so the sticky actions column hides what scrolls under it, and that column follows the row's hover.

The pane shows the item read-only. `entityItem.toReadOnly()` is a copy without its HAL-FORMS templates, so every template-gated action (edit, delete, link, unlink, unlink all) is absent; the actions without a template of their own check `isReadOnly`: `canUploadContent` and the to-many `canUnlinkItem` are `false`, and the to-many read hooks return a read-only item's linked items read-only, so their Delete is absent too. `useEntityItemSectionProps({ item, allowEdit: false })` gives that copy, so a variation's `allowEdit={false}` makes the whole item read-only. The pane reuses the item page's pieces through the `entity-item` entry point: `ContentPreviewPanel`, `ContentAttributeSelector`, `EntityItemReference`, and `EntityItemSections` with `useEntityItemSectionProps({ allowEdit: false })` for the details.

## Layering

```
@contentgrid/views
  entity-item-collection-view    unchanged: onEntityItemClick -> navigation.openItem

@contentgrid/features
  entity-item-collection/
    entity-item-collection-browser  owns previewedId, isWide (useContainerWidthAtLeast on its root);
                                    previewed item = shown page's item with that id;
                                    ResizableSplitLayout (wide) or Dialog (narrow);
                                    onEntityItemClick -> table's onEntityItemOpen
    entity-item-preview-pane        Preview / Details tabs, chosen attribute; region named after the item
                                    -> ../entity-item (ContentPreviewPanel, ContentAttributeSelector,
                                       EntityItemSections, useEntityItemSectionProps,
                                       EntityItemReference, selectDefaultContentAttribute)
    entity-item-collection-table    onEntityItemClick (row), onEntityItemOpen (View), currentItem

  entity-item/
    use-entity-item-section-props    allowEdit: false -> item.toReadOnly() for the whole variation
    relations/relation-to-one-section, relation-to-many-section
                                     actions follow the (read-only) item; Details only with onItemClick

@contentgrid/navigator-data
  accessors/entity-item            toReadOnly(), isReadOnly; canUploadContent false when read-only
  accessors/entity-item-to-many-relation  canUnlinkItem false when the source is read-only
  hooks/relation/use-entity-item-to-many-relation(-infinite)  linked items of a read-only item read-only

@contentgrid/ui
  patterns/record-table/table-row  current (aria-current); row keys only from the row itself;
                                   opaque fill; sticky cell follows the row's hover
  patterns/record-table/record-table-header  opaque fill
  patterns/resizable-split-layout  handleHidden
  styles/preset.css                --table-row, --table-header
```

## Files

**`packages/ui`**

- `src/styles/preset.css`: `--table-row`, `--table-header` (opaque fills mixed from theme tokens, so not repeated under `.dark`)
- `src/patterns/record-table/table-row.tsx`: `current` → `aria-current="true"` and the highlight. Enter/Space preview only when `event.target` is the row; Space there does not scroll. `bg-table-row`; the sticky actions cell follows the row's hover.
- `src/patterns/record-table/record-table-header.tsx`: `bg-table-header`
- `src/patterns/pdf-viewer/pdf-viewer.tsx`: `scrollbar-subtle` on the viewport
- `src/patterns/resizable-split-layout.tsx`: `handleHidden` hides the handle while the right panel is closed

**`packages/navigator-data`**

- `src/accessors/entity-item.ts`: `toReadOnly()` (no `_templates`, `isReadOnly: true`); `canUploadContent` is `false` on a read-only item
- `src/accessors/entity-item-collection.ts`: `toReadOnly()`, whose items are read-only
- `src/accessors/entity-item-to-many-relation.ts`: `canUnlinkItem` is `false` when the source item is read-only
- `src/hooks/relation/use-entity-item-to-many-relation.ts`, `use-entity-item-to-many-relation-infinite.ts`: a read-only source item's linked items come back read-only
- `src/hooks/preview/use-content-preview.ts`: `contentPreviewVersion`: the item's ETag, or its content metadata when it has none; used in the preview's query key

**`packages/features`**

- `src/entity-item-collection/entity-item-collection-browser.tsx`: previewed id, width, split layout or dialog (titled with the item's name), focus return to the row or the table's region, Escape in the pane
- `src/entity-item-collection/entity-item-preview-pane.tsx` (new)
- `src/entity-item-collection/entity-item-collection-table.tsx`: `onEntityItemOpen` (View shown only with it), `currentItem` → the row's `current`, no actions column when no row has an action
- `src/entity-item/index.ts`: exports `EntityItemSections` and `useEntityItemSectionProps`
- `src/entity-item/use-entity-item-section-props.ts`: `allowEdit: false` gives the sections `item.toReadOnly()`; the variations (`attribute-focus`, `content-focus`, `side-by-side`) show that item everywhere, and `EntityItemSections` loses its own `allowEdit`
- `src/entity-item/relations/relation-to-one-section.tsx`, `relation-to-many-section.tsx`: a related item is clickable only with `onItemClick`; a to-many table drops its actions column when no row has an action
- `src/entity-item/variations/content-focus/components/content-preview-panel.tsx`: a viewer error is kept until the content changes, not reset by a new item object
- `src/entity-item/variations/content-focus/components/content-preview-frame.tsx`: "No file uploaded yet" with an icon
- `src/entity-item/variations/content-focus/components/image-video-viewer.tsx`: `scrollbar-subtle`
- `src/entity-item/attributes/entity-item-attributes.tsx`, `renderers/attribute-value-renderer.tsx`, `renderers/content-attribute-renderer.tsx`: a long value wraps; a cut-off file name shows in full on hover
- `src/entity-item/CLAUDE.md`: the preview pane imports through `index.ts` only

**`packages/views`**: no change.

## Tests

- `entity-item-collection-browser.test.tsx`:
  - a narrow view previews in a dialog; crossing the width closes the preview
  - a wide view previews in the pane; View opens the page
  - without `onEntityItemClick` there is no View and a row still previews
  - Preview and Details tabs for an entity with a content attribute
  - a filter that drops the previewed item closes the pane; one that keeps it does not
  - a refetch with changed values shows them; the file is downloaded again only when its metadata changed
  - the pane expands when a row is previewed and collapses when it closes; dragging it shut closes the preview
  - no separator while nothing is previewed
  - no tabs for an entity without content attributes; the preview stays mounted behind Details
  - deleting the previewed item closes the pane; deleting another keeps it
  - focus stays on the row when the pane opens and returns to it when the pane closes; to the table's region when the row is gone; focus outside the pane is left alone
  - Escape closes the pane with focus inside it, and does nothing with focus on a row
  - the dialog is named after the item, takes focus, and returns it to the row when it closes; it keeps its item while it animates closed
  - collapsing the pane from its handle returns focus to the row
- `entity-item-collection-table.test.tsx`: View only with `onEntityItemOpen`; the current row has `aria-current`; no actions column when no row has an action.
- `use-content-preview.test.tsx`: without an ETag, changed content metadata gives a new key; with one, the key is unchanged.
- `entity-item.test.ts`, `entity-item-collection.test.ts`, `entity-item-to-many-relation.test.ts`, `use-entity-item-to-many-relation.test.tsx`: a read-only item has no update, delete, upload, add, clear or unlink, keeps its links, and lists its linked items read-only.
- `relation-to-one-section.test.tsx`, `relation-to-many-section.test.tsx`: no Link, Unlink, Unlink all or Delete on a read-only relation; no actions column when read-only without `onItemClick`; the reference is not a button without `onItemClick`.
- `table-row.test.tsx`: Enter or Space on a button inside the row does not call the row's `onClick`; Space on the row does not scroll.
- `relation-to-many-section.test.tsx`: no Details action without `onItemClick`.
- `content-preview-panel.test.tsx`: no drop zone when the item may not upload.
