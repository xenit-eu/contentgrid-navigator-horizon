# Research: Add Edit Form

**Feature**: [spec.md](spec.md) · **Date**: 2026-09-29

Input for `/speckit-plan`. Records how the original Navigator ([`xenit-eu/contentgrid-navigator`](https://github.com/xenit-eu/contentgrid-navigator)) edits items, what the update form looks like on the wire, and which Horizon pieces already exist.

## 1. Original Navigator behaviour

Repository: [`xenit-eu/contentgrid-navigator`](https://github.com/xenit-eu/contentgrid-navigator). Main files, as paths in that repository:

- `src/modules/EntityInstance/components/Metadata/components/Metadata.tsx` — Edit button, lines 182-184
- `src/modules/EntityInstance/components/Metadata/components/MetadataEditEntityInstance.tsx` — the form
- `src/modules/EntityInstance/hooks/useEntityInstanceState.ts` — edit state, file queue, save

| Topic                | Behaviour                                                                                                                                                                                                                                                                                                               | Where                                                |
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
| Why step 1 resets    | The update is a full PUT. Sending the new filename before the upload succeeds would leave metadata describing a file that is not there                                                                                                                                                                                  | `save` comment                                       |
| File failure         | `performFileAction` catches errors and stores them on the file change; save does not throw, edit mode closes, the file shows the error                                                                                                                                                                                  | `performFileAction`                                  |
| Metadata failure     | `saveMutation` error shown with `ServerErrorMessage` above the form; stays in edit mode                                                                                                                                                                                                                                 | `MetadataEditEntityInstance.tsx`                     |
| Conflicts            | No ETag / `If-Match` anywhere in its code: concurrent changes are overwritten                                                                                                                                                                                                                                           | grep `if-match`, `etag`: none                        |
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

## 3. Horizon building blocks

| Need                     | Existing piece                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update request           | `editEntityRequest` in `packages/navigator-data/src/accessors/entity-item.ts`                                                                                     |
| Update hook              | `useUpdateEntityItem` in `packages/navigator-data/src/hooks/item/use-update-entity.ts` — attaches `If-Match`                                                      |
| ETag                     | `fetchHal` returns the item's `etag`; `EntityItem` keeps it                                                                                                       |
| Content upload           | `uploadContentRequest` / `canUploadContent` in `entity-item.ts`; `useUploadContent` in `hooks/item/use-content.ts`. No delete request                             |
| Forms                    | The `hal-forms` feature: `resolveHalFormsFields`, `HalFormsContainer`, `useHalFormsFieldState` (takes `initialValues`; `buildValues` sends every non-empty value) |
| File input               | `packages/ui/src/patterns/file-upload-zone/`; the form `FileRenderer` in `hal-forms`                                                                              |
| Error display            | `ProblemAlert` (incl. `VersionConflictAlert` for 412), `getValidationFieldErrors`, `toServerFieldErrors`                                                          |
| Success feedback         | sonner `toast.success("<Entity> has been successfully created!")` in `create-entity-item-container.tsx`                                                           |
| Unsaved changes          | `useUnsavedChangesGuard` + `UnsavedChangesDialog`, `onDirtyChange` on the create form                                                                             |
| Item page                | `EntityItemView`, content-focus view `entity-item-content-focus-view.tsx`, `EntityItemAttributes` panel                                                           |
| Relations                | `relation-to-one-section.tsx`, `relation-to-many-section.tsx`                                                                                                     |
| Relation problem dialogs | `apps/navigator/src/routes/_app/$entity/$itemId.tsx`                                                                                                              |

D3–D6 below were written before the form stack moved to `hal-forms`; for PR 1 they are superseded by D9–D15.

## 4. Deliberate differences from the original Navigator

| Original Navigator          | This feature                               | Reason                                                   |
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
- **Rationale**: the original Navigator removes a file with DELETE on the content link (`performFileAction`). No template exists for it, exactly as for content PUT/GET.
- **Alternatives**: clear the file by sending empty `<attr>.filename`/`<attr>.mimetype` in the metadata PUT — rejected, it does not remove the stored bytes and the server behaviour is undocumented. **Constitution impact**: principle I names content PUT/GET as the only binary exception; this extends it to DELETE, so the plan's Complexity Tracking justifies it, and the constitution gets a matching amendment in the implementation PR that adds the request.

### D3 — `UpdateHalFormTemplate` accessor for the item `default` template

**Superseded by D9.**

- **Decision**: add `accessors/extended-forms/update-form.ts` with `UpdateHalFormTemplate`, exposed as `entityItem.updateTemplate` (null when absent). It gives `userDefinedProperties` (same `CreateFormProperty` shape) and `contentAttributes`: one entry per content attribute with its `filename` and `mimetype` property names.
- **Rationale**: constitution II requires template access through `navigator-data` accessors, next to `CreateHalFormTemplate`. The data layer already owns the `filename`/`mimetype` names (`ContentMetadata`, `entity-item.ts:608`), so the dot-notation mapping lives there and never in feature code. Content attributes are found with `attr.isContent`, not by sub-field names.
- **Alternatives**: read `entityItem.defaultTemplate` properties in the feature — rejected, raw template parsing in a feature (constitution II).

### D4 — Field descriptors: extend `file`, add no new kind

**Superseded for PR 1 by D9 and D10** (fields come from `resolveHalFormsFields`); PR 2 revisits the `file` field.

- **Decision**: a new `resolveEditFieldDescriptors(updateTemplate)` in `entity-item-create/model/` emits the same `FieldDescriptor` union. Each content attribute becomes one `file` descriptor with an optional `metadata: { filenameProperty, mimetypeProperty }`; its two dot-notation properties are not emitted as separate text fields. The shared HAL wire-type switch moves to the feature's `util/` and is used by both resolvers.
- **Rationale**: the audit's rule "extend `FieldDescriptor` only if needed" and constitution VIII (transformations in `util/`, no duplicated wire-type switch).
- **Alternatives**: a new `content-metadata` kind — rejected, it splits one attribute across two descriptors that have to stay in sync.

### D5 — Edit mode lives inside the item views

**Superseded by D14** (Edit next to the item title, no `allowEdit` prop in PR 1).

- **Decision**: `EntityItemView` and `EntityItemContentFocusView` own an `isEditing` state and swap `EntityItemAttributes` for a new `EntityItemEditPanel`. The Edit button is added by the views themselves to their toolbar `actions`, gated on `entityItem.canUpdate`. Apps change nothing but an optional `allowEdit` flag (default `true`) for read-only embeddings.
- **Rationale**: FR-003 (in place, no route); constitution VIII (apps pass only primitives; views own their content); constitution V (`canUpdate`).
- **Alternatives**: a `~edit` route — rejected by the Q3 answer (loses preview and context).

### D6 — Form state and the conflict merge

**Superseded by D11** (Refresh reloads the latest version into the form; the user's unsaved input is not kept).

- **Decision**: reuse `useEntityItemCreateFormState` (it already takes `initialValues` for edit mode). Initial values come from decoding the item body through the template codec. On 412, refetch the item, rebuild initial values from it, and re-apply only the fields the user changed (`dirtyFields`) on top. A field that both users changed keeps the user's value and shows a "changed by someone else" hint with the other value.
- **Rationale**: FR-023; constitution I ("re-fetch, re-apply the user's change, retry", never auto-retry in the hook).
- **Alternatives**: discard input on 412 — rejected by the Q1 answer.

### D7 — Pending file previews

- **Decision**: in the content-focus layout a picked PDF is previewed from the local `File` through the existing `PdfViewer` (it takes bytes). A picked non-PDF shows a "Preview available after saving" state, since renditions exist only for stored files.
- **Rationale**: FR-011; `002-pdf-viewer` notes the viewer takes bytes so local preview can reuse it.
- **Alternatives**: upload to preview — rejected, violates FR-009 (nothing sent before save).

### D8 — Upload progress

- **Decision**: file steps report progress through an XHR-based fetch, added to `navigator-data/src/api/` in PR 2.
- **Rationale**: FR-015; `fetch` has no upload progress events.
- **Alternatives**: no progress — rejected by FR-015.

### D9 — `UpdateHalFormTemplate` (supersedes D3 for PR 1)

- **Decision**: `accessors/extended-forms/update-form.ts` wraps the item `default` template with the item's `ProfileEntity`: `userDefinedProperties` (the same `FormAttributeProperty` shape and `toFormAttributeProperty` classification as `CreateHalFormTemplate`). Exposed as `entityItem.updateTemplate`. The prefill, the item body decoded through the template codec, is `entityItem.updateFormValues`, so the wrapper holds no item data. `resolveHalFormsFields` accepts it on the create path.
- **Rationale**: one wrapper per template kind, as for create and search; the decode stays in the data layer; the resolver's existing mapping covers every property kind on the update template.
- **Alternatives**: pass the raw `default` template to `CreateHalFormTemplate` — rejected, wrong request spec type and a misleading name.

### D10 — PR 1 shows content metadata as plain text fields

- **Decision**: `<attr>.filename` and `<attr>.mimetype` render as the text fields the template lists; no content-specific code in PR 1. PR 2 folds them into the file field.
- **Rationale**: the update is a full PUT, so these values must be sent back, or the item would lose its file metadata. Rendering what the template lists sends them without special-casing.
- **Alternatives**: hide them and pass the stored values through — needs the content special-casing that PR 2 adds anyway.

### D11 — 412: the view reloads the item, the form opens on the latest version (implements FR-023 for PR 1)

- **Decision**: on 412 the form shows the conflict (`VersionConflictAlert` through `ProblemAlert`) and disables Save. Its Refresh calls the view's `onRefresh`, which is `item.refetch()` on the view's own item query (`refetch` cancels a fetch already in flight, which could have been sent before the save and return the older version). The view's edit mode (`useEditMode`) holds the version the form was opened on and passes it down; a background refetch does not change it, so the user's input stays and a save of an item that changed meanwhile gets the 412. Refresh replaces it with the refetched version; `EditableEntityItemAttributes` keys the form by `item.etag`, so the form opens again on the latest version and the next save is conditional on it. The form holds no item of its own and never fetches.
- **Rationale**: FR-023. The view that fetched the item owns refreshing it; a form keeping its own copy of the item, or its own reload, splits one item into two representations.
- **Alternatives**: name the changed fields and let the user apply them under their own changes — rejected, it needs the form to keep the version it was opened with next to the view's latest one; keep the old form values and only swap the ETag — rejected, it would overwrite the other user's changes.

### D12 — Validation problems on the fields, other errors in the alert

- **Decision**: both containers show a validation problem only on its fields (`toServerFieldErrors`) and every other error in `ProblemAlert` (`isValidationProblem`, `toProblemDisplayModel`).
- **Rationale**: every validation error carries a `field` naming one of the template's properties, and every template property is a form field, so a validation problem always has a field to show on. No extra helper is needed.

### D13 — Item PUT answers 204; the update hook re-fetches

- **Decision**: `useUpdateEntityItem` sends the PUT with `fetchVoid`, then `invalidateQueries` on the item's `entityItem.byUrl` key, so the shown item is re-fetched with its new body and ETag before the mutation settles. A failed re-fetch does not fail the save: the PUT went through, and the item view keeps the item it has (D15). The 412 path reloads with the item query's own `refetch` (D11), which also cancels a fetch in flight.
- **Why not `fetchQuery` after the save**: `fetchQuery` joins a fetch of the item already in flight, which was sent before the PUT and can return the old version and ETag, so the next save would get a 412. `invalidateQueries` cancels that fetch and starts a new one, and it never throws.
- **Rationale**: verified on a real backend: item PUT returns 204 No Content. Parsing the empty body threw after a successful save and left the old ETag cached, so the next save got a 412.
- **Alternatives**: parse the body when there is one and re-fetch otherwise — rejected, two code paths for one server behaviour.

### D14 — Edit sits at the right of the item's title row

- **Decision**: both views show the Edit action as a pencil on a filled primary-colored rounded box (the `ui` Button `default` variant, for contrast in both themes; an "Edit" tooltip and accessible name), at the right of the item's title row: the page header of `EntityItemView`, and the side panel header of the content-focus layout, next to the panel's toggle. There is no "Attributes" heading. The views own edit mode and pass `isEditing`/`onEditingChange` to `EditableEntityItemAttributes`.
- **Rationale**: icon-only and quiet, it lines up with the relation sections' actions on the page and pairs with the side panel's toggle; the primary tint stands out from the page background while staying in the app's palette.
- **Alternatives**: an "Attributes" heading row with a labelled button — replaced, the heading added nothing; a box on the page's own background — rejected, too little contrast; the outline variant's grey fill — rejected, it read as a heavy block in dark mode; a bare pencil right after the item's name — rejected on review; the toolbar actions slot — rejected, far from the item and easy to miss.

### D15 — A failed refetch keeps the loaded item and the open form

- **Decision**: both item views render the item whenever one is loaded (`item.data`), not only on `isSuccess`. When a refetch of a loaded item fails, the loaded item and an open edit form with its input stay on screen; the error page is only for an item that never loaded.
- **Rationale**: SC-005 and the network and session edge cases. The item refetches in the background (window focus, relation changes); on failure TanStack Query keeps the data but reports `error`, and rendering on `isSuccess` alone unmounted the edit form and lost the input. A successful background refetch does not reach the open form either: it stays on the version it was opened on (D11).
- **Alternatives**: a warning with Retry above the item — dropped, the only alert the views show is for a 412 (D11).

## 6. Remaining open questions

- Confirm on a real backend that a property left out of the PUT is cleared (plan § Open questions).
- No Horizon design exists for an edit screen. If one is made, align the action bar and edit-mode heading with it.
- Confirm with the platform team that `If-Match` is accepted on `cg:content` PUT and DELETE (D1, D2). `uploadContentRequest` already sends it; no problem is known.
