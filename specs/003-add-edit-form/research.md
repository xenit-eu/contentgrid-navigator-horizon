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

**Superseded by D14** (Edit in an "Attributes" heading row, no `allowEdit` prop in PR 1).

- **Decision**: `EntityItemView` and `EntityItemContentFocusView` own an `isEditing` state and swap `EntityItemAttributes` for a new `EntityItemEditPanel`. The Edit button is added by the views themselves to their toolbar `actions`, gated on `entityItem.canUpdate`. Apps change nothing but an optional `allowEdit` flag (default `true`) for read-only embeddings.
- **Rationale**: FR-003 (in place, no route); constitution VIII (apps pass only primitives; views own their content); constitution V (`canUpdate`).
- **Alternatives**: a `~edit` route — rejected by the Q3 answer (loses preview and context).

### D6 — Form state and the conflict merge

**Superseded by D11** (`useHalFormsFieldState.updateInitialValues`, no "changed by someone else" hints).

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

### D11 — 412 keeps the user's changes on the latest version (implements FR-023 for PR 1)

- **Decision**: on 412 the item is refetched and `useHalFormsFieldState.updateInitialValues(latest.updateFormValues)` moves the form onto it: fields the user has not changed (compared against the form's own initial values, so an empty field is never counted as a change) take the latest values, the user's changes stay on top and still count as unsaved. The container then edits the latest item, so the next save uses its ETag. Until then it keeps the item it was opened with, so a background reload never changes the ETag a save sends. The form is not rebuilt; the 412 stays in the form's alert slot (`ProblemAlert` → `VersionConflictAlert`) as the mutation's error and clears on the next save; no toast, since the form already has a place for errors. No "changed by someone else" hints.
- **Rationale**: FR-023 (Q1 answer). Re-seeding with the latest ETag means the next Save cannot overwrite fields the user did not touch.
- **Alternatives**: keep the old form values and only swap the ETag — rejected, it would overwrite the other user's changes to untouched fields.

### D12 — Share the create form's non-field error selection

- **Decision**: move the create container's "which error goes in the alert" logic into `hal-forms/state/get-form-alert-error.ts` and use it from both containers.
- **Rationale**: one rule for which errors go in the alert, in both forms; a copy would drift.

### D13 — Item PUT answers 204; the update hook re-fetches

- **Decision**: `useUpdateEntityItem` sends the PUT with `fetchVoid`, then `invalidateQueries` on the item's `entityItem.byUrl` key, so the shown item is re-fetched with its new body and ETag before the mutation settles. A failed re-fetch does not fail the save: the PUT went through, and the item query shows its own error. `useReloadEntityItem` (`fetchQuery`) is only for the 412 path, which needs the latest item returned.
- **Why not `fetchQuery` after the save**: `fetchQuery` joins a fetch of the item already in flight, which was sent before the PUT and can return the old version and ETag, so the next save would get a 412. `invalidateQueries` cancels that fetch and starts a new one, and it never throws.
- **Rationale**: verified on a real backend: item PUT returns 204 No Content. Parsing the empty body threw after a successful save and left the old ETag cached, so the next save got a 412.
- **Alternatives**: parse the body when there is one and re-fetch otherwise — rejected, two code paths for one server behaviour.

### D14 — Edit sits in an "Attributes" heading row, not the toolbar

- **Decision**: both views show an "Attributes" heading styled like "Relations", with the Edit button (outline, pencil icon) at its right, as the relation sections place "+ Link". In the content-focus layout this is inside the side panel.
- **Rationale**: in the toolbar the button was far from what it edits and easy to miss. A right-aligned button under the attributes looked detached. The heading row puts the action next to the values it changes and matches an existing page pattern.
- **Alternatives**: the toolbar actions slot — rejected for visibility; under the attribute table — rejected for looks.

### D15 — A failed refetch keeps the loaded item and the open form

- **Decision**: both item views render the item whenever one is loaded (`item.data`), not only on `isSuccess`. When a refetch of a loaded item fails, `EntityItemRefreshAlert` (warning, Retry calls `refetch`) is shown above it; the error page is only for an item that never loaded.
- **Rationale**: SC-005 and the network and session edge cases. The item refetches in the background (window focus, relation changes, the reload after a 412); on failure TanStack Query keeps the data but reports `error`, and rendering on `isSuccess` alone unmounted the edit form and lost the input.
- **Alternatives**: the error page unless edit mode is open — rejected, it needs edit state lifted out of the attributes panel and still hides a usable page; `ProblemAlert` with the raw problem — rejected, it does not say that the shown values may be out of date and has no Retry for this case.

## 6. Remaining open questions

- Confirm on a real backend that a property left out of the PUT is cleared (plan § Open questions).
- No Horizon design exists for an edit screen. If one is made, align the action bar and edit-mode heading with it.
- Confirm with the platform team that `If-Match` is accepted on `cg:content` PUT and DELETE (D1, D2). `uploadContentRequest` already sends it; no problem is known.
