# Contract: `@contentgrid/ui` patterns

Plain scalar props only — no `FieldDescriptor`, `EntityItem` or HAL types (constitution III). Each pattern ships a story with play tests and Playwright snapshots (light and dark).

## `EditActionBar` (patterns/edit-action-bar/) — new

```ts
interface EditActionBarProps {
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly saving?: boolean; // disables Save, shows spinner (FR-019)
  readonly dirty?: boolean; // shows "Unsaved changes" (FR-003b)
  readonly saveLabel?: string; // default "Save"
  readonly cancelLabel?: string; // default "Cancel"
}
```

Sticky to the bottom of its scroll container; keyboard order Cancel → Save; Save is the submit button of the enclosing form.

## `FileRenderer` (patterns/form-renderers/) — extended

```ts
interface FileRendererProps {
  // existing: name, label, required, description, value, onChange, error, …
  readonly current?: { filename: string | null; mimetype: string | null } | null;
  readonly pending?: { kind: "replace"; filename: string; progress?: number } | { kind: "remove" };
  readonly failureMessage?: string;
  readonly filename?: string; // editable filename input (update form)
  readonly onFilenameChange?: (filename: string) => void;
  readonly onRemove?: () => void;
  readonly onUndo?: () => void; // withdraw pending change
  readonly onRetry?: () => void;
}
```

States (one story each): empty, current file, replace pending, remove pending, uploading with progress, failed with retry, disabled (no permission).

## Conflict hint

`FieldShell` gains an optional `hint` slot (`ReactNode`) rendered under the input, used for "Changed by someone else: <value>" (D6). No new component.

## Motion

View ↔ edit uses a 150–200 ms opacity/height transition via existing tokens; disabled under `prefers-reduced-motion` (FR-003a).
