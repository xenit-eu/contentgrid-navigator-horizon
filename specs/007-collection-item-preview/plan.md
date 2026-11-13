# Implementation Plan: Item Preview in the Entity Collection

**Spec**: [`spec.md`](spec.md)

## Summary

`EntityItemCollectionBrowser` (`packages/features`) owns the preview; `EntityItemCollectionView` (`packages/views`) does not change. The pane is read-only and opens nothing, so the view has nothing to add. The view keeps passing `onEntityItemClick` as "open the item's page" (`navigation.openItem`). The row click stays inside the feature.

The browser keeps the previewed item's self link href, not the item object. On each render it looks that href up in the page the table shows (`collection.data.items`), so the pane always shows the item as the list has it. A refetch after an edit elsewhere or a delete updates or removes it. When the href is not in the shown page, the browser clears it and the preview closes. This covers a filter, sort or page change and a delete here or elsewhere, so the table needs no delete callback. While a new page loads, the previous page stays shown (`keepPreviousData`), so the pane closes only once the new page is in.

The browser measures its own root with `useContainerWidthAtLeast(rootRef, "side-by-side")` (880 px, as in 006), so a split pane, the chat or the sidebar all count. In a wide view it renders the table and `EntityItemPreviewPane` in a `ResizableSplitLayout` whose right panel is always there, collapsed while nothing is previewed, so opening the pane never remounts the table. In a narrow view it renders the pane in a `Dialog`. The view crossing the width closes the preview.

The table's row click previews the row. Its View action calls a new `onEntityItemOpen`, which the browser wires to its own `onEntityItemClick`. Without it, View is not shown and rows still preview. `RecordTableRow` gains `current` (`aria-current="true"` plus the highlight), and its Enter/Space handler only acts on keys pressed on the row itself, not on its buttons or checkbox. The row and header fills become opaque (`--table-row`, `--table-header`), so the sticky actions column hides what scrolls under it, and that column follows the row's hover.

The pane reuses the content-focus pieces through the `entity-item` entry point: `ContentPreviewPanel` with `allowUpload={false}`, `ContentAttributeSelector`, `EntityItemReference`, `EntityItemAttributes` and a new `EntityItemRelations` with `allowEdit={false}`. `EntityItemRelations` is the "Relations" section that the attribute-focus and content-focus variations each repeat today; both variations use it.

## Layering

```
@contentgrid/views
  entity-item-collection-view    unchanged: onEntityItemClick -> navigation.openItem

@contentgrid/features
  entity-item-collection/
    entity-item-collection-browser  owns previewedHref, isWide (useContainerWidthAtLeast on its root);
                                    previewed item = shown page's item with that self link;
                                    ResizableSplitLayout (wide) or Dialog (narrow);
                                    onEntityItemClick -> table's onEntityItemOpen
    entity-item-preview-pane        Preview / Details tabs, chosen attribute; region named after the item
                                    -> ../entity-item (ContentPreviewPanel, ContentAttributeSelector,
                                       EntityItemAttributes, EntityItemRelations,
                                       EntityItemReference, selectDefaultContentAttribute)
    entity-item-collection-table    onEntityItemClick (row), onEntityItemOpen (View), currentItemHref

  entity-item/
    relations/entity-item-relations  the "Relations" section; allowEdit
                                     -> RelationToOneSection, RelationToManySection (allowEdit)
    variations/attribute-focus, variations/content-focus  -> EntityItemRelations
    variations/content-focus/components/content-preview-panel  allowUpload

@contentgrid/ui
  patterns/record-table/table-row  current (aria-current); row keys only from the row itself;
                                   opaque fill; sticky cell follows the row's hover
  patterns/record-table/record-table-header  opaque fill
  styles/preset.css                --table-row, --table-header
```

## Files

**`packages/ui`**

- `src/styles/preset.css`: `--table-row`, `--table-header` (opaque fills mixed from theme tokens, so not repeated under `.dark`)
- `src/patterns/record-table/table-row.tsx`: `current` → `aria-current="true"` and the highlight. Enter/Space preview only when `event.target` is the row. `bg-table-row`; the sticky actions cell follows the row's hover.
- `src/patterns/record-table/record-table-header.tsx`: `bg-table-header`
- `src/patterns/pdf-viewer/pdf-viewer.tsx`: `scrollbar-subtle` on the viewport

**`packages/features`**

- `src/entity-item-collection/entity-item-collection-browser.tsx`: previewed href, width, split layout or dialog, focus return to the row
- `src/entity-item-collection/entity-item-preview-pane.tsx` (new)
- `src/entity-item-collection/entity-item-collection-table.tsx`: `onEntityItemOpen` (View shown only with it), `currentItemHref` → the row's `current`
- `src/entity-item/relations/entity-item-relations.tsx` (new), exported from `src/entity-item/index.ts`; used by `variations/attribute-focus/entity-item-attribute-focus.tsx` and `variations/content-focus/entity-item-content-focus.tsx`
- `src/entity-item/relations/relation-to-one-section.tsx`, `relation-to-many-section.tsx`: `allowEdit`; a related item is clickable only with `onItemClick`
- `src/entity-item/variations/content-focus/components/content-preview-panel.tsx`: `allowUpload`
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
  - a refetch with changed values shows them
  - deleting the previewed item closes the pane; deleting another keeps it
  - focus stays on the row when the pane opens and returns to it when the pane closes
- `entity-item-collection-table.test.tsx`: View only with `onEntityItemOpen`; the current row has `aria-current`.
- `table-row.test.tsx`: Enter on a button inside the row does not call the row's `onClick`.
- `relation-to-many-section.test.tsx`: no Details action without `onItemClick`.
- `content-preview-panel.test.tsx`: no drop zone with `allowUpload={false}`.
