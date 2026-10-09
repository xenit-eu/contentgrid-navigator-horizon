# Contract: Upload into an empty content attribute

**Requirements**: FR-014 – FR-019
**Extends**: `specs/002-pdf-viewer/contracts/content-focus-view.md` ("No file" state)

## `ContentPreviewFrame` (presentational)

**File**: `packages/features/src/entity-item/variations/content-focus/components/content-preview-frame.tsx`

- New state `"uploading"`: skeleton + caption `labels.uploadingCaption` (default "Uploading…"); no actions.
- `noFile`: renders `FileUploadZone` **only when `onFileChange` is provided**; otherwise the "No file" caption only. `NOOP_FILE_CHANGE` is removed.
- `noFile` + `problem`: the problem alert is shown above the drop zone.

## `ContentPreviewPanel` (owns data)

**File**: `.../content-focus/components/content-preview-panel.tsx`

```ts
const canUpload = entityItem.canUploadContent(attributeName);
const uploadMutation = useUploadContent(entityItem, attributeName);
```

| Condition                                                    | Frame props                                                                                                            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `uploadMutation.isPending`                                   | `state="uploading"` (with `toolbarStart`)                                                                              |
| `state === "noFile"` and `canUpload`                         | `onFileChange={(file) => file && uploadMutation.mutate({ file })}`                                                     |
| `uploadMutation.error`, `state === "noFile"`, same attribute | `problem={toProblemDisplayModel(uploadMutation.error)}`                                                                |
| error is 412 (`unsatisfied-version`)                         | no panel code: `useUploadContent`'s `onError` invalidates the item query (`queryKeys.entityItem.byUrl`) — research D10 |

- The panel records the attribute an upload was made for (set in the drop handler, no effect) and shows an upload error only while that attribute is selected.
- Success: `useUploadContent` already writes the fresh item into the cache; the viewer key `${attributeName}:${etag}` changes and the preview reloads. No extra code.

## Tests

- Frame: `noFile` without handler shows no drop zone; with handler shows it; `uploading` shows caption.
- Panel: drop calls the upload with the selected attribute; no drop zone when `canUploadContent` is false; error shows the problem and the drop zone.
- `useUploadContent` (`navigator-data/src/hooks/item/use-content.test.tsx`): a 412 marks the cached item query invalidated.
- Story: `ContentPreviewFrame` `Uploading` (+ snapshot).
