# Contract: `@contentgrid/navigator-data` additions

Public API added by this feature. Signatures are the contract; names may be refined in review.

## `EntityItem` (accessors/entity-item.ts)

```ts
class EntityItem {
  /** The item's update form, or null when the user may not update the item. */
  get updateTemplate(): UpdateHalFormTemplate | null;

  /** Link presence gate for removing a stored file (same link as upload/download). */
  canDeleteContent(attributeName: string): boolean;

  /**
   * DELETE on the attribute's `cg:content` link, with `If-Match` when an ETag is known.
   * Binary-content exception (constitution I, amended with this feature). Send with `contentFetch`.
   * @throws Error when the `cg:content` link is absent.
   */
  deleteContentRequest(attributeName: string): Request;
}
```

Existing and unchanged: `canUpdate`, `editEntityRequest(values)`, `etag`, `canUploadContent`, `uploadContentRequest`.

## `UpdateHalFormTemplate` (accessors/extended-forms/update-form.ts)

```ts
interface UpdateFormContentAttribute {
  readonly profileAttribute: ProfileAttribute; // attr.isContent === true
  readonly filenameProperty: HalFormsProperty | null; // `<attr>.filename` on the template
  readonly mimetypeProperty: HalFormsProperty | null; // `<attr>.mimetype` on the template
}

class UpdateHalFormTemplate {
  readonly template: HalFormsTemplate<EntityInstanceUpdateRequestSpec>;
  /** Editable non-content properties, same shape as the create form's. */
  get userDefinedProperties(): readonly CreateFormProperty[];
  get contentAttributes(): readonly UpdateFormContentAttribute[];
  /** Item body decoded into form values through the template codec (prefill). */
  initialValues(item: EntityItem): HalFormValues<EntityInstanceUpdateRequestSpec>;
}
```

## `useSaveEntityItemEdit` (hooks/item/use-save-entity-item-edit.ts)

```ts
type PendingFileStep =
  | {
      readonly attributeName: string;
      readonly action: "replace";
      readonly file: File;
      readonly filename?: string;
    }
  | { readonly attributeName: string; readonly action: "remove" };

interface SaveEntityItemEditVariables {
  /** null when only file steps are retried. */
  readonly values: HalFormValues<EntityInstanceUpdateRequestSpec> | null;
  readonly fileSteps: readonly PendingFileStep[];
}

interface SaveEntityItemEditResult {
  readonly item: EntityItem; // latest version, fresh ETag
  readonly failedFileSteps: readonly { attributeName: string; error: Error }[];
}

function useSaveEntityItemEdit(
  entityItem: EntityItem,
  options?: {
    onFileProgress?: (attributeName: string, progress: number) => void;
    mutationOptions?: Omit<
      UseMutationOptions<SaveEntityItemEditResult, Error, SaveEntityItemEditVariables>,
      "mutationFn"
    >;
  },
): UseMutationResult<SaveEntityItemEditResult, Error, SaveEntityItemEditVariables>;
```

Behaviour:

- Metadata step failure (400/403/404/412/network) rejects with the `Error` (`ProblemDetailError` for HTTP problems). No retry, no swallowing (constitution I).
- File step failures do not reject; they are listed in `failedFileSteps`.
- Each step sends the ETag of the item returned by the previous step.
- On resolve: `setQueryData(entityItem.byUrl)` with `result.item`; invalidate `entityItemCollection.forEntity`.

## `xhrFetch` (api/xhr-fetch.ts)

Lifted from `ACC-3090-wire-content-upload-with-progress`. `(request: Request, onUploadProgress?: (fraction: number) => void) => Promise<Response>`, with the same auth handling as `contentFetch`.

## MSW test fixtures (test-fixtures/msw/handlers.ts)

- `createUpdateHandler`: add `etag` option; respond 412 `unsatisfied-version` when `If-Match` differs.
- `createContentUploadHandler`: same `If-Match` check.
- NEW `createContentDeleteHandler({ url, etag? })` → 204, or 412 on mismatch.
