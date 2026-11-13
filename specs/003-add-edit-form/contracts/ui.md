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
  // other props unchanged
}
```

The selected-file card shows a type icon (image, video, PDF, other) in a tile, or a thumbnail for a
picked image; a stored file has no thumbnail, its bytes are not loaded. Story: `StoredFile`.

## `FileRenderer` (patterns/form-renderers/)

`value: FileSummary | undefined` (a picked `File` or a stored file); `onChange` receives the picked
`File`, or `undefined` when the file is removed. `hideLabel` hides the label visually (it still names the field).
