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

  /**
   * `filename`, `mimetype`: the name and media type to store the file under; the file's own when
   * omitted. A `mimetype` other than the file's goes in the multipart part's `Content-Type`.
   */
  uploadContentRequest(
    attributeName: string,
    file: File,
    contentEtag: string | null,
    filename?: string,
    mimetype?: string,
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
interface ContentChange {
  /** The file to store, or `null` to remove the stored file. */
  readonly file: File | null;
  /** The name and media type to store `file` under; the file's own when absent. */
  readonly filename?: string;
  readonly mimetype?: string;
}
/** Attribute name → its queued change. */
type ContentChanges = ReadonlyMap<string, ContentChange>;

interface ContentChangeResult {
  /** Percentage (0–100) of the file sent; absent for a removal. */
  readonly progress?: number;
  /** Why the change failed; absent unless it did. */
  readonly error?: Error;
}
/** Attribute name → how far its change got. */
type ContentChangeResults = ReadonlyMap<string, ContentChangeResult>;

function useApplyContentChanges(entityItem: EntityItem): UseMutationResult<
  ContentChangeResults,
  Error,
  ContentChanges
> & {
  /** Follows the changes while they run. */
  results: ContentChangeResults;
};
```

Behaviour:

- Changes run one after the other. Before each, a HEAD on the `cg:content` link reads the content's
  own ETag (404 → no file; a 200 without a readable ETag fails the change).
- A `file` is sent with `uploadContentRequest(attr, file, contentEtag, filename, mimetype)`: `If-Match` when
  a file is stored, `If-None-Match: *` when none is. A `null` file is sent with
  `deleteContentRequest(attr, contentEtag)`, or not at all when no file is stored.
- A failed change does not stop the others; the mutation resolves with the results keyed by
  attribute name (no `error` in any of them: all applied).
- Once settled: invalidate `entityItem.byUrl` for the item and `entityItemCollection.forEntity`.

`useUpdateEntityItem` gains `invalidateOnSuccess` (default `true`). The update form calls it
first, with `false` when file changes follow, since the file step refreshes the item and its lists
itself (see `data-model.md`).
