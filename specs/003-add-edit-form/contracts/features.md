# Contract: `@contentgrid/features` changes

## PR 1

### Item views (entity-item)

No new props. Both views own edit mode (`useEditContext(item, refetch)`, entity-item/edit/, internal: the version of the shown item being edited, `null` when not editing; a background refetch does not change it, `refresh` moves it to the refetched version; it ends when the view moves to another item and stays closed on coming back) and the item query. Next to the item title they show `EditEntityItemButton`, which renders when the item is not being edited and `item.updateTemplate` is not `null` and has at least one property (spec edge case: nothing to change otherwise). There is no "Attributes" heading. Below, `EditableEntityItemAttributes` (entity-item/attributes/, internal) shows `EntityItemAttributes`, or `EditEntityItemContainer` while editing.

Both views render the item while one is loaded (`item.data`), not only on `isSuccess`. When a refetch of a loaded item fails, the loaded item and an open edit form with its input stay on screen. `ErrorPage` is only for an item that never loaded (research D15).

### `entity-item/edit/` (internal to `entity-item`)

```ts
/** An item whose update form has at least one property. */
type EditableEntityItem = EntityItem & { readonly updateTemplate: UpdateHalFormTemplate };
function isEditableEntityItem(item: EntityItem): item is EditableEntityItem;

function EditableEntityItemAttributes(props: {
  readonly item: EntityItem;
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
  /** Reloads the item after a version conflict. */
  readonly onRefresh: () => void;
}): JSX.Element;

function EditEntityItemContainer(props: {
  readonly item: EditableEntityItem;
  /** Leaves edit mode: after a successful save, or on Cancel (confirmed first when dirty). */
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}): JSX.Element;
```

Layered like `entity-item-create`:

- While editing, the views pass the edited version as `item`. `EditableEntityItemAttributes` keys `EditEntityItemContainer` by `item.etag`, so the form opens again only when Refresh passes a newer version.
- `EditEntityItemContainer` owns the unsaved-changes guard and dialog, from its own form state's `isDirty`. It takes `item` only for the form. Fields come from `resolveHalFormsFields(item.updateTemplate)`, prefill from `item.updateFormValues` (empty when `null`), saving from `useUpdateEntityItem(item)`, so a save is conditional on `item`'s ETag. Success toast: `"<Entity> has been successfully updated!"`. Errors: a validation problem → its fields (`toServerFieldErrors`); any other error → `ProblemAlert`; 412 → `ProblemAlert` (`VersionConflictAlert`) whose Refresh calls `onRefresh`, and Save disabled; 404 → Save disabled.
- The view's `onRefresh` is `useEditContext`'s `refresh`: `item.refetch()`, then the refetched version becomes the edited one. It has a new ETag, so the form opens again on the latest version; the user's unsaved input is not kept.
- `EditEntityItemForm` renders the `<form>`, `HalFormsContainer` and Save/Cancel.

### `useHalFormsFieldState` (hal-forms/state/)

- Dirty tracking compares dates by time, so a re-decoded or re-picked date is not a change.

### `resolveHalFormsFields` (hal-forms/model/)

Template parameter widened to `CreateHalFormTemplate | UpdateHalFormTemplate | SearchHalFormTemplate`; an update template uses the create path (attributes only).

## PR 2

### `useEntityItemContext` (entity-item/use-entity-item-context.ts)

Gains `pendingContent: ContentChanges` and `setPendingContent`. Opening or closing the form and
moving to another item clear them; `refresh` keeps them. It also gains `contentFailures:
ReadonlyMap<string, string>` (attribute name → message of the file change the last Save could not
apply) and `setContentFailures`, cleared with `pendingContent` and kept by `refresh`; changing an
attribute's file through `setPendingContent` drops that attribute's failure. It also gains
`isSaving` and `setIsSaving`, set by the form while it saves; they are cleared with
`pendingContent`.

### `EditableEntityItemAttributes` / `EditEntityItemContainer` (entity-item/)

Both gain `pendingContent` and `onPendingContentChange`, `contentFailures` and
`onContentFailuresChange`, and `onSavingChange`; the variations get
them from the item context through `useEntityItemSectionProps` and `EntityItemSections`.

### `EditContentFields` (entity-item/edit/edit-content-fields.tsx)

```ts
interface EditContentFieldsProps {
  readonly item: EditableEntityItem;
  readonly pendingContent: ContentChanges;
  /** The message of each failed file change, by attribute name; shown on that attribute's card. */
  readonly contentFailures: ReadonlyMap<string, string>;
  readonly onContentChange: (attributeName: string, file: File | null) => void;
  /** While Save stores the picked files, each one's upload progress, by attribute name. */
  readonly uploadProgress?: ReadonlyMap<string, number>;
  /** Makes every file field read-only. */
  readonly disabled?: boolean;
  readonly renderMetadataFields: (attributeName: string) => ReactNode;
  readonly previewedAttributeName?: string;
  readonly onPreview?: (attributeName: string) => void;
}
```

One compact `FileRenderer` per content attribute of the item, below the template's fields: the
picked file, else the stored one. While it shows a file, the attribute's `<attr>.filename`/
`<attr>.mimetype` fields follow, labelled as the template gives them, all in a `Card` styled like
the relation sections, through `renderMetadataFields` (a `HalFormsContainer` with just those
fields); the container takes them out of the main layout (`layoutWithoutContentMetadata`). Values,
validation are unchanged; Save is two-step: the metadata PUT, then the file changes (see
`data-model.md`). The file field shows no required asterisk: the form doesn't
check that a file stays. In
content focus with more than one file, the previewed file's card is highlighted, the others offer
Preview; a picked file comes into the preview (the container calls `onPreview`). Read-only without the attribute's
`cg:content` link. The file fields are also read-only while Save runs (`disabled`), so no file
can be picked or removed after the save has started; the content-focus drop zone takes no file
then either. The update template has no file property, so these fields are rendered next to
`HalFormsContainer` rather than through it; they add no field kind, `kind` switch or field-state
hook.

### Content-focus preview

While editing, `EntityItemContentFocus` shows the form's file for the previewed attribute:
`FilePreview` for a picked file, and for no file (removed, or none stored) a filling
`ContentPreviewFrame state="noFile"` drop zone that picks into the form through
`withContentChange` (nothing is uploaded before Save). Otherwise `ContentPreviewPanel`. The form's
file fields use `FileRenderer`'s compact mode; their filename and mimetype fields follow the map
whichever side changed it. A picked file is stored under the name and media type in its filename
and mimetype fields.
