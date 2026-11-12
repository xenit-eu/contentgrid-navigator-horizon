# Contract: `@contentgrid/navigator-data` additions

## PR 1

```ts
class EntityItem {
  /** The item's `default` (update) template, wrapped; null when the user may not update the item. */
  get updateTemplate(): UpdateHalFormTemplate | null;
  /** The item body decoded through the `default` template's codec (prefill); null without it. */
  get updateFormValues(): FieldValueMap | null;
}

class UpdateHalFormTemplate {
  readonly template: HalFormsTemplate<EntityInstanceUpdateRequestSpec>;
  /** Same shape and classification as CreateHalFormTemplate.userDefinedProperties. */
  get userDefinedProperties(): readonly FormAttributeProperty[];
}
```

`updateTemplate` is cached per `EntityItem`, so the form's fields keep their identity; `updateFormValues` is cached per `EntityItem` too (the form reads it once, at mount, and after a 412 from the reloaded item).

`CreateFormProperty` is renamed `FormAttributeProperty` (accessors/extended-forms/form-property.ts, with `toFormAttributeProperty`), since the create and update forms share it. `CreateHalFormTemplate.contentProperties` had no caller and is removed.

`useUpdateEntityItem`: same arguments; the mutation data is now `void`. The PUT answers 204, so it is sent with `fetchVoid`; on success it invalidates `entityItem.byUrl`, so the shown item is re-fetched (cancelling a fetch already in flight) before the mutation settles. A failed re-fetch does not fail the save.

Unchanged and reused: `canUpdate`, `editEntityRequest`, `etag`.

MSW `createUpdateHandler`: matches `PUT` (was `PATCH`).

## PR 2

### `EntityItem` (accessors/entity-item.ts)

```ts
class EntityItem {
  /**
   * DELETE on the attribute's `cg:content` link, with `If-Match` carrying the content's own ETag.
   * Binary-content exception (constitution I). Send with `contentFetch`.
   * @throws Error when the `cg:content` link is absent.
   */
  deleteContentRequest(attributeName: string, contentEtag: string): Request;

  /** `filename`: the name to store the file under; the file's own name when omitted. */
  uploadContentRequest(
    attributeName: string,
    file: File,
    contentEtag: string | null,
    filename?: string,
  ): Request;
}
```

The `cg:content` link gates removal as it gates upload: no separate `canDeleteContent`; callers use
`canUploadContent`.

### `UpdateHalFormTemplate` (accessors/extended-forms/update-form.ts)

```ts
class UpdateHalFormTemplate {
  /** `<attr>.filename` / `<attr>.mimetype` when the template has them, else undefined. */
  contentMetadataPropertyNames(attributeName: string): {
    readonly filename?: string;
    readonly mimetype?: string;
  };
}
```

### `useApplyContentChanges` (hooks/item/use-content.ts)

```ts
/** Attribute name → `File` to store, or `null` to remove the stored file. */
type ContentChanges = ReadonlyMap<string, File | null>;

function useApplyContentChanges(entityItem: EntityItem): UseMutationResult<
  ReadonlyMap<string, Error>,
  Error,
  {
    changes: ContentChanges;
    /** Attribute name → name to store the picked file under; the file's own name when absent. */
    filenames: ReadonlyMap<string, string>;
  }
>;
```

Behaviour:

- Changes run one after the other. Before each, a HEAD on the `cg:content` link reads the content's
  own ETag (404 → no file; a 200 without a readable ETag fails the change).
- A `File` is sent with `uploadContentRequest(attr, file, contentEtag, filename)`: `If-Match` when
  a file is stored, `If-None-Match: *` when none is. `null` is sent with
  `deleteContentRequest(attr, contentEtag)`, or not at all when no file is stored.
- A failed change does not stop the others; the mutation resolves with the failures keyed by
  attribute name (empty map: all applied).
- Once settled: invalidate `entityItem.byUrl` for the item and `entityItemCollection.forEntity`.

`useUpdateEntityItem` gains `invalidateOnSuccess` (default `true`). The update form calls it
first, with `false` when file changes follow, since the file step refreshes the item and its lists
itself (see `data-model.md`).
