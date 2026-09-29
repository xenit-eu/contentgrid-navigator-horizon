# Research: Add Edit Form

**Feature**: [spec.md](spec.md) · **Date**: 2026-09-29

Input for `/speckit-plan`. Records how the legacy Navigator edits items, what the update form looks like on the wire, and which Horizon pieces already exist.

## 1. Legacy Navigator behaviour

Repository: `contentgrid-navigator` (legacy). Main files:

- `src/modules/EntityInstance/components/Metadata/components/Metadata.tsx` — Edit button, lines 182-184
- `src/modules/EntityInstance/components/Metadata/components/MetadataEditEntityInstance.tsx` — the form
- `src/modules/EntityInstance/hooks/useEntityInstanceState.ts` — edit state, file queue, save

| Topic                | Legacy behaviour                                                                                                                                                                                                                                                                                                        | Where                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Entry                | "Edit" button in the metadata panel, shown when `entityInstance.defaultTemplate && allowEditAttributes`                                                                                                                                                                                                                 | `Metadata.tsx:182`                                   |
| Read-only embeddings | `allowEditAttributes={false}` in the search-page item preview and one embedded item view                                                                                                                                                                                                                                | `SearchEntityPage.tsx:202`, `EntityInstance.tsx:217` |
| Presentation         | The edit form replaces the metadata panel in place (`isEditPanelOpened`); the preview pane stays                                                                                                                                                                                                                        | `Metadata.tsx:90`                                    |
| Form source          | `new FlatJsfFormConvertor(entityInstance.defaultTemplate)` — every property of the item's `default` template                                                                                                                                                                                                            | `MetadataEditEntityInstance.tsx`                     |
| Prefill              | `codecs.requireCodecFor(defaultTemplate).decode({ contentType: "application/json", body: accessor.data })` — item body decoded through the template codec                                                                                                                                                               | `createFormValues`                                   |
| Relations            | Not in the form. Linked/unlinked in `MetadataRelations` / `MetadataRelation` with `set-`/`add-` templates                                                                                                                                                                                                               | `MetadataRelation.tsx:52`                            |
| Content in edit mode | Each content attribute renders a `FileUpload` under the form (`MetadataEntityInstanceContent`)                                                                                                                                                                                                                          | `MetadataEditEntityInstance.tsx`                     |
| Picking a file       | Queued as a file change (`uploadFileAction`), not sent. Sets `<attr>.filename` / `<attr>.mimetype` form values to the picked file. Preview switches to it                                                                                                                                                               | `uploadFileAction`, `setFileFormValues`              |
| Removing a file      | Queued (`deleteFileAction`); removes the two form values                                                                                                                                                                                                                                                                | `deleteFileAction`                                   |
| Outside edit mode    | Upload/delete runs immediately                                                                                                                                                                                                                                                                                          | `uploadFile`, `deleteFile`                           |
| Save order           | 1. Reset file-related form values to the stored file's name/type (`resetSymbol`), encode with the template codec, send. 2. For each queued change, `performFileAction` in sequence (DELETE on the content link, or upload with progress using the form's filename). 3. `invalidateQueries` and wait. 4. Close edit mode | `save`                                               |
| Why step 1 resets    | The update is a full PUT. Sending the new filename before the upload succeeds would leave metadata describing a file that is not there (cf. ACC-1411, "content gets accidentally cleared when saving metadata")                                                                                                         | `save` comment                                       |
| File failure         | `performFileAction` catches errors and stores them on the file change; save does not throw, edit mode closes, the file shows the error                                                                                                                                                                                  | `performFileAction`                                  |
| Metadata failure     | `saveMutation` error shown with `ServerErrorMessage` above the form; stays in edit mode                                                                                                                                                                                                                                 | `MetadataEditEntityInstance.tsx`                     |
| Conflicts            | No ETag / `If-Match` anywhere in the legacy code: concurrent changes are overwritten                                                                                                                                                                                                                                    | grep `if-match`, `etag`: none                        |
| Cancel               | Discards form values and queued file changes (keeps uploads already in flight); no confirmation                                                                                                                                                                                                                         | `cancelEditAction`                                   |
| Filename edit        | Filename/mimetype are ordinary text fields; an edited filename is shown and used for the next upload                                                                                                                                                                                                                    | `createAllFiles`, `performFileAction`                |

## 2. Update form on the wire

From `docs/audits/entity-profile-templates-inventory.md` §8.5 and `docs/audits/phase-5d7-workitems.md` WI-20. Fixtures: `packages/navigator-data/test-fixtures/halforms/items/`.

- The item's `default` template: method `PUT`, `contentType: application/json`, present on every item the user may update.
- The profile-level `default` template is different (`HEAD`, no properties) and is not an update form.
- No `value` on any property: prefill must come from the item body.
- No `readOnly` on any property; audit fields are omitted from the template.
- Content attributes appear as two `text` properties, `<attr>.filename` and `<attr>.mimetype` (the create form has one `file` property instead). File bytes go through the item's `cg:content` link, not the update form.
- Relations are not in the `default` template; they have `set-<rel>` (PUT `text/uri-list`), `add-<rel>` (POST) and `clear-<rel>` templates.

## 3. Horizon building blocks on `main` (2026-09-29)

| Need                     | Existing piece                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Update request           | `editEntityRequest` in `packages/navigator-data/src/accessors/entity-item.ts`                                                            |
| Update hook              | `useUpdateEntityItem` in `packages/navigator-data/src/hooks/item/use-update-entity.ts` — attaches `If-Match`, no UI caller yet           |
| ETag                     | `fetchHal` returns the item's `etag`; `EntityItem` keeps it (`entity-item.ts:63`)                                                        |
| Content upload           | `uploadContentRequest` / `canUploadContent` in `entity-item.ts`; `useUploadContent` in `hooks/item/use-content.ts`. No delete request    |
| Form renderers           | `FieldRenderer` + `FieldDescriptor` in `packages/features/src/entity-item-create/`; inputs in `packages/ui/src/patterns/form-renderers/` |
| File input               | `packages/ui/src/patterns/file-upload-zone/`; form `FileRenderer` in ACC-2895 (in review)                                                |
| Error display            | `ProblemAlert`, `getValidationFieldErrors`, `toFieldErrors` (used by `create-entity-item-container.tsx`)                                 |
| Success feedback         | sonner `toast.success("<Entity> has been successfully created!")` in `create-entity-item-container.tsx:154`                              |
| Unsaved changes          | `onDirtyChange` / `isDirty` on the create form                                                                                           |
| Item page                | `EntityItemView` (`actions` toolbar slot), content-focus view `entity-item-content-focus-view.tsx`, `EntityItemAttributes` panel         |
| Relations                | `relation-to-one-section.tsx`, `relation-to-many-section.tsx` (ACC-2883)                                                                 |
| Relation problem dialogs | `apps/navigator/src/routes/_app/$entity/$itemId.tsx`                                                                                     |

The resolver currently builds descriptors from the create template (`resolve-create-field-descriptors.ts`). It must also handle the item `default` template, where content attributes are the two dot-notation text properties.

## 4. Deliberate differences from legacy

| Legacy                      | This feature                               | Reason                                                   |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| No conflict detection       | Conditional save (`If-Match`), 412 handled | Project rule: always send ETags on mutations (CLAUDE.md) |
| Cancel without confirmation | Confirm when there are unsaved changes     | Matches the Horizon create form                          |
| Error box only              | Inline field errors + alert for the rest   | Matches the Horizon create form                          |
| No success feedback         | Toast on success                           | Matches the Horizon create form                          |

## 5. Plan decisions (Phase 0)

Format per `/speckit-plan`: decision, rationale, alternatives considered.

### D1 — One save orchestration hook in `navigator-data`

- **Decision**: add `useSaveEntityItemEdit(entityItem)` in `navigator-data/src/hooks/item/`. One mutation runs the whole save: metadata PUT, then each pending file step in order, then a final item fetch. Every step uses the ETag returned by the step before it.
- **Rationale**: `useUploadContent` sends `If-Match` from the `EntityItem` it was created with (`uploadContentRequest`, `entity-item.ts:438`). After the metadata PUT the item has a new ETag, so a second hook bound to the old item would fail every upload with 412. Chaining inside one mutation passes the fresh `EntityItem` from step to step. It also keeps HAL knowledge (request building, ETags, cache updates) in the data layer (constitution III).
- **Alternatives**: compose `useUpdateEntityItem` + `useUploadContent` in the feature — rejected, stale ETag on every upload after a metadata change. Let the server skip `If-Match` on content PUT — rejected, constitution I requires it on every mutation.

### D2 — Removing a file uses a new `deleteContentRequest`

- **Decision**: add `EntityItem.deleteContentRequest(attributeName)` and `canDeleteContent(attributeName)` (link presence), used only by D1. DELETE on the `cg:content` link with `If-Match`, sent with `contentFetch`.
- **Rationale**: the legacy Navigator removes a file with DELETE on the content link (`performFileAction`). No template exists for it, exactly as for content PUT/GET.
- **Alternatives**: clear the file by sending empty `<attr>.filename`/`<attr>.mimetype` in the metadata PUT — rejected, it does not remove the stored bytes and the server behaviour is undocumented. **Constitution impact**: principle I names content PUT/GET as the only binary exception; this extends it to DELETE, so the plan's Complexity Tracking justifies it, and the constitution gets a matching amendment in the implementation PR that adds the request.

### D3 — `UpdateHalFormTemplate` accessor for the item `default` template

- **Decision**: add `accessors/extended-forms/update-form.ts` with `UpdateHalFormTemplate`, exposed as `entityItem.updateTemplate` (null when absent). It gives `userDefinedProperties` (same `CreateFormProperty` shape) and `contentAttributes`: one entry per content attribute with its `filename` and `mimetype` property names.
- **Rationale**: constitution II requires template access through `navigator-data` accessors, next to `CreateHalFormTemplate`. The data layer already owns the `filename`/`mimetype` names (`ContentMetadata`, `entity-item.ts:608`), so the dot-notation mapping lives there and never in feature code. Content attributes are found with `attr.isContent`, not by sub-field names.
- **Alternatives**: read `entityItem.defaultTemplate` properties in the feature — rejected, raw template parsing in a feature (constitution II).

### D4 — Field descriptors: extend `file`, add no new kind

- **Decision**: a new `resolveEditFieldDescriptors(updateTemplate)` in `entity-item-create/model/` emits the same `FieldDescriptor` union. Each content attribute becomes one `file` descriptor with an optional `metadata: { filenameProperty, mimetypeProperty }`; its two dot-notation properties are not emitted as separate text fields. The shared HAL wire-type switch moves to the feature's `util/` and is used by both resolvers.
- **Rationale**: the audit's rule "extend `FieldDescriptor` only if needed" (ACC-2899) and constitution VIII (transformations in `util/`, no duplicated wire-type switch).
- **Alternatives**: a new `content-metadata` kind — rejected, it splits one attribute across two descriptors that have to stay in sync.

### D5 — Edit mode lives inside the item views

- **Decision**: `EntityItemView` and `EntityItemContentFocusView` own an `isEditing` state and swap `EntityItemAttributes` for a new `EntityItemEditPanel`. The Edit button is added by the views themselves to their toolbar `actions`, gated on `entityItem.canUpdate`. Apps change nothing but an optional `allowEdit` flag (default `true`) for read-only embeddings.
- **Rationale**: FR-003 (in place, no route); constitution VIII (apps pass only primitives; views own their content); constitution V (`canUpdate`).
- **Alternatives**: a `~edit` route — rejected by the Q3 answer (loses preview and context).

### D6 — Form state and the conflict merge

- **Decision**: reuse `useEntityItemCreateFormState` (it already takes `initialValues` for edit mode). Initial values come from decoding the item body through the template codec (as legacy `createFormValues`). On 412, refetch the item, rebuild initial values from it, and re-apply only the fields the user changed (`dirtyFields`) on top. A field that both users changed keeps the user's value and shows a "changed by someone else" hint with the other value.
- **Rationale**: FR-023; constitution I ("re-fetch, re-apply the user's change, retry", never auto-retry in the hook).
- **Alternatives**: discard input on 412 — rejected by the Q1 answer.

### D7 — Pending file previews

- **Decision**: in the content-focus layout a picked PDF is previewed from the local `File` through the existing `PdfViewer` (it takes bytes). A picked non-PDF shows a "Preview available after saving" state, since renditions exist only for stored files.
- **Rationale**: FR-011; `002-pdf-viewer` notes the viewer takes bytes so local preview can reuse it.
- **Alternatives**: upload to preview — rejected, violates FR-009 (nothing sent before save).

### D8 — Upload progress

- **Decision**: file steps report progress through an XHR-based fetch. `xhr-fetch.ts` exists on the unmerged `ACC-3090-wire-content-upload-with-progress` branch; the plan lifts it into `navigator-data/src/api/` as part of this feature, unless ACC-3090 merges first.
- **Rationale**: FR-015; `fetch` has no upload progress events.
- **Alternatives**: no progress — rejected by FR-015.

## 6. Remaining open questions

- The design mockup (`contentgrid-navigator-mockup 2.html`, referenced in `specs/002-pdf-viewer/research.md`) was not available when this was written. If it has an edit screen, align the action bar and edit-mode heading with it.
- Confirm with the platform team that `If-Match` is accepted on `cg:content` PUT and DELETE (D1, D2). `uploadContentRequest` already sends it; no problem is known.
