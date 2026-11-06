# Implementation Plan: Item Preview in the Entity Collection

**Spec**: [`spec.md`](spec.md)

## Summary

`EntityItemCollectionView` keeps the previewed item and whether the screen is wide (`useMediaQuery(SPLIT_BREAKPOINT_QUERY)`). On a wide screen it renders the table and `EntityItemPreviewPane` in a `ResizableSplitLayout` whose right panel is always there, collapsed while no row is open, so opening the pane never remounts the table; on a narrow screen it renders the pane in a `Dialog`. Crossing the breakpoint closes the preview. A row click previews the row; the host's `onEntityItemClick` moves to the row's View action (`onEntityItemOpen`). The table reports a delete through `onEntityItemDeleted`, which closes the pane when it was the previewed item. The pane reuses the content-focus pieces through the `entity-item` entry point: `ContentPreviewPanel` with `allowUpload={false}`, `ContentAttributeSelector`, `EntityItemAttributes` and the new `EntityItemRelations` with `allowEdit={false}`. The record table pattern puts its table actions in the actions column's header and gets opaque row and header fills for the sticky column.

## Layering

```
entity-item-collection/
  entity-item-collection-view    owns previewedItem, isWide (useMediaQuery);
                                 ResizableSplitLayout (wide) or Dialog (narrow)
  entity-item-preview-pane       Preview / Details tabs, chosen attribute
                                 -> ../entity-item (ContentPreviewPanel, ContentAttributeSelector,
                                    EntityItemAttributes, EntityItemRelations,
                                    EntityItemReference, selectDefaultContentAttribute)
  entity-item-collection-table   onEntityItemClick (row), onEntityItemOpen (View),
                                 onEntityItemDeleted

entity-item/
  relations/entity-item-relations  the "Relations" section; allowEdit
                                   -> RelationToOneSection, RelationToManySection (allowEdit)
  entity-item-view, content-focus view  -> EntityItemRelations
  content-focus/content-preview-panel   allowUpload

@contentgrid/ui
  patterns/record-table          tableActions in the actions column header; opaque sticky cells
  styles/preset.css              --table-row, --table-header
```

## Files

**`packages/ui`**

- `src/styles/preset.css`: `--table-row`, `--table-header` (opaque fills mixed from theme tokens, so not repeated under `.dark`)
- `src/patterns/record-table/record-data-table.tsx` (+ story `WithTableActionsInActionsColumn`): `tableActions` go in the actions column's header when there is one, else above the table
- `src/patterns/record-table/record-table-header.tsx`: `actions`; `bg-table-header`
- `src/patterns/record-table/table-row.tsx`: `bg-table-row`; the sticky actions cell follows the row's hover
- `src/patterns/pdf-viewer/pdf-viewer.tsx`: `scrollbar-subtle` on the viewport

**`packages/features`**

- `src/entity-item-collection/entity-item-collection-view.tsx`, `entity-item-collection-search-view.tsx` (doc only)
- `src/entity-item-collection/entity-item-preview-pane.tsx` (new)
- `src/entity-item-collection/entity-item-collection-table.tsx`: `onEntityItemOpen`, `onEntityItemDeleted`; View is a `RecordRowAction`, shown only with `onEntityItemOpen`
- `src/entity-item/relations/entity-item-relations.tsx` (new), exported from `src/entity-item/index.ts`; used by `entity-item-view.tsx` and `entity-item-content-focus-view.tsx`
- `src/entity-item/relations/relation-to-one-section.tsx`, `relation-to-many-section.tsx`: `allowEdit`; a related item is clickable only with `onItemClick`
- `src/entity-item/variations/content-focus/components/content-preview-panel.tsx`: `allowUpload`
- `src/entity-item/variations/content-focus/components/content-preview-frame.tsx`: "No file uploaded yet" with an icon
- `src/entity-item/variations/content-focus/components/image-video-viewer.tsx`: `scrollbar-subtle`
- `src/entity-item/attributes/entity-item-attributes.tsx`, `renderers/attribute-value-renderer.tsx`, `renderers/content-attribute-renderer.tsx`: a long value wraps; a cut-off file name shows in full on hover
- `src/entity-item/CLAUDE.md`: the preview pane imports through `index.ts` only

## Tests

- `entity-item-collection-view.test.tsx`: narrow screen previews in a dialog; narrowing closes the preview; wide screen previews in the pane and View still opens the page; Preview and Details tabs for an entity with a content attribute; deleting the previewed item closes the pane, deleting another keeps it.
- `entity-item-collection-table.test.tsx`: View only with `onEntityItemOpen`.
- `relation-to-many-section.test.tsx`: no Details action without `onItemClick`.
- `content-preview-panel.test.tsx`: no drop zone with `allowUpload={false}`.
- `record-data-table.test.tsx`: table actions in the actions column's header cell.
- Visual baselines: new `Patterns/RecordDataTable` `WithTableActionsInActionsColumn`.
