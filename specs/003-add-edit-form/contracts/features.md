# Contract: `@contentgrid/features` changes

## PR 1

### Item views (entity-item)

No new props. Both views own edit mode (`useEditMode(item, refetch)`, entity-item/edit/, internal: the version of the shown item being edited, `null` when not editing; a background refetch does not change it, `refresh` moves it to the refetched version; it ends when the view moves to another item and stays closed on coming back) and the item query. Next to the item title they show `EditEntityItemButton`, which renders when the item is not being edited and `item.updateTemplate` is not `null` and has at least one property (spec edge case: nothing to change otherwise). There is no "Attributes" heading. Below, `EditableEntityItemAttributes` (entity-item/attributes/, internal) shows `EntityItemAttributes`, or `EditEntityItemContainer` while editing.

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
- The view's `onRefresh` is `useEditMode`'s `refresh`: `item.refetch()`, then the refetched version becomes the edited one. It has a new ETag, so the form opens again on the latest version; the user's unsaved input is not kept.
- `EditEntityItemForm` renders the `<form>`, `HalFormsContainer` and Save/Cancel.

### `useHalFormsFieldState` (hal-forms/state/)

- Dirty tracking compares dates by time, so a re-decoded or re-picked date is not a change.

### `resolveHalFormsFields` (hal-forms/model/)

Template parameter widened to `CreateHalFormTemplate | UpdateHalFormTemplate | SearchHalFormTemplate`; an update template uses the create path (attributes only).

## PR 2 (outline; to be rewritten against `hal-forms` when PR 2 starts)

Not built. Written before PR 1 moved to `hal-forms`; where it differs from PR 1 above (`EntityItemEditPanel`, `allowEdit`, Edit in the toolbar), PR 1 is current.

## Item views (entity-item)

Both views gain edit mode. The only new prop an app can pass is `allowEdit`.

```ts
// EntityItemView and EntityItemContentFocusView
interface EditModeProps {
  /** Show the Edit action when the item can be updated. Default true; false for read-only embeddings (FR-002). */
  readonly allowEdit?: boolean;
  /** Fired after a successful save, e.g. for app-level analytics. Optional. */
  readonly onSaved?: (target: { entityName: string; itemId: string }) => void;
}
```

- The view adds an Edit button to its toolbar `actions` (after any app-supplied actions) when `allowEdit && entityItem.canUpdate && updateTemplate has properties`.
- While editing, `EntityItemAttributes` is replaced by `EntityItemEditPanel`; header, relation sections and preview stay mounted.
- The view blocks router navigation while `isDirty` (confirm dialog), using the router's blocker.

## `EntityItemEditPanel` (entity-item/edit/)

```ts
interface EntityItemEditPanelProps {
  readonly session: EntityItemEditSession; // from useEntityItemEditSession
}
```

Renders: "Editing <item name>" heading, `ProblemAlert` for non-field problems, one `FieldRenderer` per descriptor, `EditActionBar` pinned to the panel bottom.

## `useEntityItemEditSession` (entity-item/edit/)

```ts
interface EntityItemEditSession {
  readonly status: "editing" | "saving" | "reloading" | "notFound";
  readonly fields: readonly FieldDescriptor[];
  readonly form: UseEntityItemCreateFormState; // reused hook, with initialValues
  readonly pendingFiles: ReadonlyMap<string, PendingFileChange>;
  readonly problem: ProblemDisplayModel | null;
  readonly isDirty: boolean;
  pickFile(attributeName: string, file: File): void;
  removeFile(attributeName: string): void;
  withdrawFileChange(attributeName: string): void;
  renameFile(attributeName: string, filename: string): void;
  save(): void;
  retryFailedFiles(): void;
  cancel(): void; // caller confirms first when isDirty
}

function useEntityItemEditSession(
  entityItem: EntityItem,
  callbacks: { onDone: () => void },
): EntityItemEditSession;
```

Behaviour per `data-model.md` (state transitions, conflict merge). Success toast: `"<Entity> has been successfully updated!"` via sonner.

## Field descriptors (entity-item-create/model)

```ts
// field-descriptor.ts — file variant gains optional metadata (update form only)
| ({ readonly kind: "file" } & FieldDescriptorBase & {
    readonly multiple: boolean;
    readonly metadata?: { readonly filenameProperty: string; readonly mimetypeProperty: string };
  })

function resolveEditFieldDescriptors(template: UpdateHalFormTemplate): FieldDescriptor[];
```

- One `file` descriptor per content attribute; its dot-notation properties are not emitted separately.
- The HAL wire-type → descriptor mapping moves to `entity-item-create/util/` and is shared by `resolveCreateFieldDescriptors` and `resolveEditFieldDescriptors` (constitution VIII).

## `FieldRenderer`

New optional props, used only by the edit panel for `file` descriptors with `metadata`:

```ts
readonly currentFile?: { name: string | null; mimetype: string | null } | null;
readonly pendingFile?: { action: "replace"; file: File; progress?: number; failed?: ProblemDisplayModel } | { action: "remove"; failed?: ProblemDisplayModel };
readonly onPickFile?: (file: File) => void;
readonly onRemoveFile?: () => void;
readonly onWithdrawFileChange?: () => void;
readonly onRenameFile?: (filename: string) => void;
```
