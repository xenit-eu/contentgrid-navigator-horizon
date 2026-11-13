# Data Model: Add Edit Form

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Date**: 2026-09-29

Client-side state only; the server model (entity items, content) does not change.

## PR 1 — metadata edit

Edit mode is state of the item view (`useEditContext(item, refetch)`): the version of the shown item being edited, `null` when not editing. A background refetch does not change it, so the open form keeps the user's input and a save of an item that changed meanwhile gets a 412; Refresh moves it to the refetched version. It belongs to one item (its self link), so it ends when the view moves to another item and stays closed on coming back.

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

## PR 2 — file changes

### Pending file changes

`ContentChanges` (attribute name → `File` to store, or `null` to remove), held by
`useEntityItemContext` so the form and the content-focus preview read the same map.

- Picking a file sets the entry to the `File`. Removing means "no file here": `null` when the
  attribute holds a stored file (removed on Save), else the entry is deleted. Cancel brings the
  stored file back (FR-008, FR-009).
- The attribute's `<attr>.filename`/`<attr>.mimetype` fields follow the entry: the picked file's
  name and type, empty for a removed file, the stored values once the entry is gone (FR-010).
- Opening or closing the form clears the map; `refresh` keeps it, and the reopened form shows the
  kept entries in those fields.
- While editing, the content-focus preview shows the picked file, or a drop zone that picks into
  the map when the attribute has no file in the form; picking a file brings its attribute into the
  preview (FR-011).
- `isDirty = form isDirty || map not empty`.

### Save

1. **Metadata**: `useUpdateEntityItem` PUT with `If-Match` = the item's ETag. For every attribute in
   the map, `<attr>.filename`/`<attr>.mimetype` are sent with the stored values (FR-014). A file
   changed since the form opened changed the item's ETag too, so this fails with 412 before any
   file is sent. With files to follow it doesn't refresh the cache (`invalidateOnSuccess: false`):
   the file step refreshes the item and its lists once, at the end.
2. **Files**: `useApplyContentChanges` with the map and each picked file's filename field value,
   which the file is stored under (FR-015). Each change reads the content's own ETag with a HEAD;
   removing a file that is already gone sends nothing.
3. **Result**: no failure → toast, form closes. Failures → one error toast per failed attribute,
   saying the other changes were saved; the map keeps only the failed entries, and `refresh` moves the form onto the latest item; Save
   then sends only those again (FR-024).

### Limits

- FR-015: no upload progress; Save shows "Saving…" until every change is done.
- FR-024: a failed change is reported in a toast, not on its field.
