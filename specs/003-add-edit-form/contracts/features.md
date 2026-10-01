# Contract: `@contentgrid/features` changes

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
