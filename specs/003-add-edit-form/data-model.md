# Data Model: Add Edit Form

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Date**: 2026-09-29

Client-side state only; the server model (entity items, content) does not change.

## Edit session

Owned by `useEntityItemEditSession` in the item view. Exists only while edit mode is open.

| Field            | Type                                    | Notes                                                                                                |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `baseItem`       | `EntityItem`                            | The item version the form was opened on (or reloaded to after a conflict). Its ETag guards the save. |
| `fields`         | `FieldDescriptor[]`                     | From `resolveEditFieldDescriptors(baseItem.updateTemplate)`.                                         |
| `initialValues`  | `FieldValueMap`                         | `baseItem` body decoded through the update template codec.                                           |
| `values`         | `FieldValueMap`                         | Current input (form state hook).                                                                     |
| `dirtyFields`    | `Set<string>`                           | Properties whose value differs from `initialValues`.                                                 |
| `pendingFiles`   | `Map<attributeName, PendingFileChange>` | At most one entry per content attribute.                                                             |
| `conflictHints`  | `Map<propertyName, FieldValue>`         | After a 412: the other user's value for fields both changed (D6).                                    |
| `status`         | `EditStatus`                            | See state transitions.                                                                               |
| `problem`        | `ProblemDisplayModel \| null`           | Last non-field problem, rendered by `ProblemAlert`.                                                  |
| `externalErrors` | `Record<string, FieldError[]>`          | Server field errors (`toFieldErrors(getValidationFieldErrors(error))`).                              |

Derived: `isDirty = dirtyFields.size > 0 || pendingFiles.size > 0`.

### Validation rules

- Required properties must be non-empty before a request is sent (same rules as the create form).
- Allowed-values properties: a stored value outside the allowed list is kept as is and not rejected on the client (spec edge case).
- A content attribute can only get a pending `replace` when `canUploadContent(attr)`, and a pending `remove` when `canDeleteContent(attr)` and it currently holds a file.

## Pending file change

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

## Save plan

Built from the session when the user saves; executed by `useSaveEntityItemEdit` (D1).

1. **Metadata step**: `values` with, for each attribute in `pendingFiles`, `<attr>.filename`/`<attr>.mimetype` reset to the stored file's values (FR-014), encoded by `baseItem.editEntityRequest`, sent with `If-Match: baseItem.etag`. Returns `item₁`.
2. **File steps**, in profile order of the attributes: `replace` → `item₁.uploadContentRequest(attr, file, { filename: values["<attr>.filename"] })`; `remove` → `item₁.deleteContentRequest(attr)`. Each step uses the ETag of the item returned by the previous step (after each file step the item is refetched to get the new ETag).
3. **Reload**: final item fetch; cache updated (`entityItem.byUrl`), collections invalidated.

Result: `{ item, failedFileSteps: attributeName[] }`. A failed metadata step rejects (nothing else runs). A failed file step is recorded and the remaining file steps still run (each file is reported separately — spec edge case); the mutation resolves with the failures listed.

## State transitions (`EditStatus`)

```text
viewing ──Edit──▶ editing ──Save──▶ saving ──ok, no failures──▶ viewing (+ toast)
                    ▲  │               │
                    │  └─Cancel────────┼──(dirty? confirm)──▶ viewing
                    │                  ├─400 validation──▶ editing (field errors)
                    │                  ├─412 conflict──▶ reloading ──▶ editing (merged, hints)
                    │                  ├─403──▶ editing (not permitted alert)
                    │                  ├─404──▶ notFound (only Leave)
                    │                  ├─network/other──▶ editing (ProblemAlert)
                    │                  └─file step failed──▶ editing (file flagged, retry)
                    └──────────────Retry file──────────────┘
```

- `saving` disables Save and shows progress (FR-019).
- Retry from a partial failure runs only the failed file steps, starting from the latest item and its ETag (FR-024).
- Leaving the page while `isDirty` asks for confirmation (FR-020).

## Conflict merge (D6)

On 412: fetch the latest item → `latest`. New `initialValues` = decode(`latest`). For each property in `dirtyFields`: keep the user's value; if `decode(latest)[p] ≠ oldInitialValues[p]` (the other user changed it too), record `conflictHints[p] = decode(latest)[p]`. `baseItem` becomes `latest`. Pending file changes are kept.
