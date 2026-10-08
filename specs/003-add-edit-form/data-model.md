# Data Model: Add Edit Form

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Date**: 2026-09-29

Client-side state only; the server model (entity items, content) does not change.

## PR 1 — metadata edit

Edit mode is state of the item view (`useEditMode(item, refetch)`): the version of the shown item being edited, `null` when not editing. A background refetch does not change it, so the open form keeps the user's input and a save of an item that changed meanwhile gets a 412; Refresh moves it to the refetched version. It belongs to one item (its self link), so it ends when the view moves to another item and stays closed on coming back.

State of `EditEntityItemContainer` (entity-item/edit/), alive only while edit mode is open. It holds no item of its own: the view passes the item down, and the form opens again (keyed by `item.etag`) on each new version.

| Field            | Source                                                                | Notes                                                                                                  |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| form state       | `useHalFormsFieldState({ fields, initialValues, externalErrors })`    | `fields` from `resolveHalFormsFields(item.updateTemplate)`; `initialValues` = `item.updateFormValues`. |
| `externalErrors` | `toServerFieldErrors(getValidationFieldErrors(updateMutation.error))` | Server field errors shown on their fields.                                                             |
| alert            | `updateMutation.error` unless it is a validation problem              | Every error that is not a validation problem; those show on their fields.                              |

### State transitions

```text
viewing ──Edit──▶ editing ──Save──▶ saving ──204 + item re-fetched──▶ viewing (+ toast)
                    ▲  │               │
                    │  └─Cancel────────┼──(dirty? confirm)──▶ viewing
                    │                  ├─client validation fails──▶ editing (field errors, nothing sent)
                    │                  ├─400 validation──▶ editing (field errors)
                    │                  ├─412 conflict──▶ editing (alert, Save disabled) ──Refresh──▶ editing (latest version)
                    │                  ├─403 / network / other──▶ editing (alert, input kept)
                    │                  └─404──▶ editing (alert, Save disabled, only Cancel)
```

- `saving` disables Save and shows "Saving…" (FR-019); a 412 disables Save until Refresh.
- Leaving the page while `isDirty` asks for confirmation (FR-020).
- A failed refetch of the page's item keeps the item and the open form on screen (D15).

### Conflict (D11)

On 412 the form shows "This item has been updated by someone else" (`VersionConflictAlert`) and disables Save. Refresh refetches the item and the view makes the refetched version the edited one; it has a new ETag, so the form opens again on it and the next save is conditional on that ETag. The user's unsaved input is not kept.

## PR 2 — file changes (outline; to be rewritten against `hal-forms` when PR 2 starts)

### Edit session

Extends the PR 1 state with pending file changes. Exists only while edit mode is open.

| Field            | Type                                     | Notes                                                                                                |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `baseItem`       | `EntityItem`                             | The item version the form was opened on (or reloaded to after a conflict). Its ETag guards the save. |
| `fields`         | `HalFormsField[]`                        | From `resolveHalFormsFields(baseItem.updateTemplate)`.                                               |
| `initialValues`  | `FieldValueMap`                          | `baseItem` body decoded through the update template codec.                                           |
| `values`         | `FieldValueMap`                          | Current input (form state hook).                                                                     |
| `dirtyFields`    | `Set<string>`                            | Properties whose value differs from `initialValues`.                                                 |
| `pendingFiles`   | `Map<attributeName, PendingFileChange>`  | At most one entry per content attribute.                                                             |
| `status`         | `EditStatus`                             | See state transitions.                                                                               |
| `problem`        | `ProblemDisplayModel \| null`            | Last non-field problem, rendered by `ProblemAlert`.                                                  |
| `externalErrors` | `Record<string, FieldValidationError[]>` | Server field errors (`toServerFieldErrors(getValidationFieldErrors(error))`).                        |

Derived: `isDirty = dirtyFields.size > 0 || pendingFiles.size > 0`.

#### Validation rules

- Required properties must be non-empty before a request is sent (same rules as the create form).
- Allowed-values properties: a stored value outside the allowed list is kept as is and not rejected on the client (spec edge case).
- A content attribute can only get a pending `replace` when `canUploadContent(attr)`, and a pending `remove` when `canDeleteContent(attr)` and it currently holds a file.

### Pending file change

| Field           | Type                    | Notes                                                            |
| --------------- | ----------------------- | ---------------------------------------------------------------- |
| `attributeName` | `string`                | Content attribute (`attr.isContent`).                            |
| `action`        | `"replace" \| "remove"` |                                                                  |
| `file`          | `File` (replace only)   | Never sent before Save (FR-009).                                 |
| `step`          | `FileStepState`         | `idle` → `uploading(progress 0–1)` → `done` \| `failed(problem)` |

Rules:

- Picking a file sets `<attr>.filename` and `<attr>.mimetype` in `values` to the file's name and type (media type left unchanged when the browser reports none). Withdrawing the change restores them from `initialValues` (FR-010).
- A newer pick or remove replaces the entry; withdrawing deletes it.
- Cancel clears the map; nothing is uploaded.

### Save plan

Built from the session when the user saves; executed by `useSaveEntityItemEdit` (D1).

1. **Metadata step**: `values` with, for each attribute in `pendingFiles`, `<attr>.filename`/`<attr>.mimetype` reset to the stored file's values (FR-014), encoded by `baseItem.editEntityRequest`, sent with `If-Match: baseItem.etag`. Returns `item₁`.
2. **File steps**, in profile order of the attributes: `replace` → `item₁.uploadContentRequest(attr, file, { filename: values["<attr>.filename"] })`; `remove` → `item₁.deleteContentRequest(attr)`. Each step uses the ETag of the item returned by the previous step (after each file step the item is refetched to get the new ETag).
3. **Reload**: final item fetch; cache updated (`entityItem.byUrl`), collections invalidated.

Result: `{ item, failedFileSteps: attributeName[] }`. A failed metadata step rejects (nothing else runs). A failed file step is recorded and the remaining file steps still run (each file is reported separately — spec edge case); the mutation resolves with the failures listed.

### State transitions (`EditStatus`)

```text
viewing ──Edit──▶ editing ──Save──▶ saving ──ok, no failures──▶ viewing (+ toast)
                    ▲  │               │
                    │  └─Cancel────────┼──(dirty? confirm)──▶ viewing
                    │                  ├─400 validation──▶ editing (field errors)
                    │                  ├─412 conflict──▶ reloading ──▶ editing (merged)
                    │                  ├─403──▶ editing (not permitted alert)
                    │                  ├─404──▶ notFound (only Leave)
                    │                  ├─network/other──▶ editing (ProblemAlert)
                    │                  └─file step failed──▶ editing (file flagged, retry)
                    └──────────────Retry file──────────────┘
```

- `saving` disables Save and shows progress (FR-019).
- Retry from a partial failure runs only the failed file steps, starting from the latest item and its ETag (FR-024).
- Leaving the page while `isDirty` asks for confirmation (FR-020).

### Conflict merge (D11)

As in PR 1; pending file changes are kept.
