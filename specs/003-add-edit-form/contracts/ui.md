# Contract: `@contentgrid/ui` patterns

Plain scalar props only — no `EntityItem` or HAL types (constitution III).

## `FileUploadZone` (patterns/file-upload-zone/)

```ts
/** What the zone shows of a file; a `File` matches it. */
interface FileSummary {
  readonly name: string;
  readonly size: number; // bytes
  readonly type: string; // empty when unknown
}

interface FileUploadZoneProps {
  file: FileSummary | null; // a picked `File` or a stored file
  /** While the file is uploaded, its progress (0–100); the file can't be removed meanwhile. */
  uploadProgress?: number;
  // other props unchanged
}
```

The full selected-file card shows a thumbnail for a picked image, else an icon; a stored file has
no thumbnail, its bytes are not loaded. With `compact`, the selected file is a two-line card with
one generic file icon in a tile: the name, and below it the size and type. While `uploadProgress` is
set, the second line shows "Uploading… n%" in place of the size and type (stopping at 99% until
the server has confirmed the upload) and the remove button is hidden. Stories: `CompactStoredFile`
and `CompactUploading`.

## `FileRenderer` (patterns/form-renderers/)

`value: FileSummary | undefined` (a picked `File` or a stored file); `onChange` receives the picked
`File`, or `undefined` when the file is removed. `compact` and `uploadProgress` are passed on to
`FileUploadZone`.
