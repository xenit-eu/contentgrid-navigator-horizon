# Contract: `@contentgrid/features` changes

## PR 1

### Item views (entity-item)

No new props. Both views render `EntityItemAttributesPanel` (entity-item/attributes/, internal), keyed by `<profile name>/<item id>`: an "Attributes" heading with an Edit button at its right when `item.updateTemplate` is not `null` and has at least one property (spec edge case: nothing to change otherwise). Edit captures that template; while editing, the button hides and `EntityItemAttributes` is replaced by `EditEntityItemView`.

Both views render the item while one is loaded (`item.data`), not only on `isSuccess`. When a refetch of a loaded item fails, `EntityItemRefreshAlert` (entity-item/, internal; warning tone, Retry calls `item.refetch()`) is shown above it and an open edit form keeps its input. `ErrorPage` is only for an item that never loaded (research D15).

### `entity-item/edit/` (internal to `entity-item`)

```ts
function EditEntityItemView(props: {
  readonly item: EntityItem;
  /** The item's update form (`item.updateTemplate`), captured when Edit was chosen. */
  readonly updateTemplate: UpdateHalFormTemplate;
  /** Leaves edit mode: after a successful save, or on Cancel (confirmed first when dirty). */
  readonly onClose: () => void;
}): JSX.Element;
```

Layered like `entity-item-create`:

- `EditEntityItemView` owns the unsaved-changes guard and dialog (`onDirtyChange` from the container).
- `EditEntityItemView` passes `item` and `updateTemplate` to the container. Prefill is `item.updateFormValues` (empty when `null`).
- `EditEntityItemContainer` keeps the item it was opened with in state, so a background reload never changes the ETag a save sends. On 412 it reloads the item (`useReloadEntityItem`), calls `formState.updateInitialValues(latest.updateFormValues)` and edits the latest item from then on. Fields come from `resolveHalFormsFields(updateTemplate)`, prefill from `updateFormValues`, saving from `useUpdateEntityItem(editedItem)`. Success toast: `"<Entity> has been successfully updated!"`. Errors: `getFormAlertError` → `ProblemAlert`; field errors → `toServerFieldErrors`; 412 → initial values updated to the latest version; the conflict stays in `ProblemAlert` (it is the mutation's error) until the next save; 404 → Save disabled. A failed reload after a 412 keeps the form, its input and the alert; saving again retries.
- `EditEntityItemForm` renders the `<form>`, `HalFormsContainer` and Save/Cancel.

### `getFormAlertError` (hal-forms/state/)

```ts
function getFormAlertError(
  error: Error | null,
  fields: readonly HalFormsField[],
): Error | undefined;
```

Moved from `create-entity-item-container.tsx`; both containers use it.

### `useHalFormsFieldState` (hal-forms/state/)

- New method `updateInitialValues(initialValues)`: moves the form onto new initial values; fields the user has not changed take the new values, the user's changes stay on top and still count as unsaved.

### `resolveHalFormsFields` (hal-forms/model/)

Template parameter widened to `CreateHalFormTemplate | UpdateHalFormTemplate | SearchHalFormTemplate`; an update template uses the create path (attributes only).

## PR 2 (outline; to be rewritten against `hal-forms` when PR 2 starts)

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
  readonly conflictHints: ReadonlyMap<string, FieldValue>;
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
readonly conflictValue?: FieldValue; // "Changed by someone else: …" hint
```
