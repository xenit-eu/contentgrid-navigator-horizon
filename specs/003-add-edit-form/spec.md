# Feature Specification: Add Edit Form

**Feature Branch**: `003-add-edit-form`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Edit all the fields of any entity item from its detail page, in the Horizon design.

**Research**: [`research.md`](research.md) records how the original Navigator implements editing, what the update template looks like on the wire, and which Horizon building blocks already exist. It is input to `/speckit-plan`, not part of the requirements.

## Scope

**In scope**

- Editing an existing entity item from its detail page, for every entity of the application, driven entirely by the item's update form as published by the API (no entity-specific screens).
- Every attribute the update form offers, of every type the create form already supports: text, email, number, boolean, date, datetime, allowed values (single and multiple) and content.
- Replacing or removing the file held in a content attribute as part of an edit, and editing that file's name and media type.
- Saving, cancelling, and every user-visible validation, conflict, permission and failure state of an edit.
- Both item page layouts: the attribute-focus layout and the content-focus layout (item with at least one content attribute).

**Out of scope** (tracked elsewhere or deferred)

- Linking and unlinking relations. Relations are managed in the item's relation sections, not in the edit form.
- Uploading a file into an empty content attribute outside edit mode (the "No file" drop area of the content-focus layout, specified in `002-pdf-viewer` and the content-upload story).
- Editing several items at once, inline editing of a single value in a table or list, and edit history or undo after saving.
- Read-only properties and client-side regex / length constraints (audit WI-19, deferred; no production update form sets them today).
- Creating a missing relation target or a new item from within the edit form.

## Delivery

Delivered in two PRs (plan.md):

- **PR 1 — metadata edit**: User Story 1 and the metadata failures of User Story 3 (scenarios 1–4, 6). FR-001, FR-003–FR-007, FR-013, FR-016–FR-023, FR-025. Content attributes show their `filename`/`mimetype` as the plain text fields the update form lists.
- **PR 2 — file changes**: User Story 2 and User Story 3 scenario 5. FR-008–FR-012, FR-014 (file part), FR-015, FR-024. Depends on the empty-content upload (`004-create-item-page`), which changes the same upload hook and content-preview components.

Not in either PR: the pinned action bar, edit-mode heading and view/edit transition (FR-003a, FR-003b). The form uses the create form's Save/Cancel row. FR-002 needs no opt-out today: the item views are only rendered by the detail routes.

## Clarifications

### Session 2026-09-29

- Q: When someone else changed the item while the form was open, what happens on save? → A: The save is refused and the user is told the item has been updated by someone else. Refresh reloads the latest version into the form; the user's unsaved input is not kept (FR-023, Story 3 scenario 2).
- Q: The attribute values saved but a file upload or removal failed. Does edit mode stay open? → A: It stays open, with the failed file flagged and a retry of only the failed steps (FR-024, Story 3 scenario 5).
- Q: How is the edit form presented? → A: Whatever looks most modern, elegant and in line with the Horizon look and feel. Chosen: in place of the attribute panel with a pinned action bar and a subtle view/edit transition (FR-003–FR-003c). It keeps the item header, relations and preview in view, which a separate page or a dialog would not.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit an item's attributes (Priority: P1)

A content editor opens an entity item, chooses Edit, and sees a form with every editable attribute already filled in with the item's current values. They change a few values, save, and the item page shows the updated values.

**Why this priority**: Correcting metadata is the most common reason to edit an item, and it is the base the other stories build on. Without it, users can only fix an item by recreating it.

**Independent Test**: Open a fixture item whose entity has text, number, boolean, date, datetime and allowed-values attributes. Choose Edit, change one value of each type, save. The item page shows every new value and no other value changed.

**Acceptance Scenarios**:

1. **Given** an item the user is allowed to update, **When** its detail page opens, **Then** an Edit action is available on the page.
2. **Given** an item the user is not allowed to update (the API publishes no update form for it), **When** its detail page opens, **Then** no Edit action is shown anywhere on the page.
3. **Given** the user chooses Edit, **When** the form opens, **Then** it lists every property of the item's update form, each pre-filled with the item's current value, empty values left empty, required fields marked `*`.
4. **Given** the form is open, **When** the user changes values and saves, **Then** the item is updated, a confirmation is shown, edit mode closes, and the page shows the new values without first flashing the old ones.
5. **Given** the form is open with unsaved changes, **When** the user cancels or navigates away, **Then** they are asked to confirm discarding their changes; confirming discards them and leaves the item unchanged.
6. **Given** the form is open without changes, **When** the user cancels, **Then** edit mode closes immediately without a confirmation.
7. **Given** the user clears a required field, **When** they try to save, **Then** the save is blocked and the field shows why, as on the create form.
8. **Given** an item of an entity with a content attribute, **When** the user edits it, **Then** the relation sections stay visible and usable, and the content preview stays visible, while the form is open.
9. **Given** the user chooses Edit on a long item, **When** the form opens, **Then** it replaces the attribute panel in place with each attribute in the same position, the panel is headed as being in edit mode, and Save and Cancel stay visible at the bottom of the panel while the user scrolls; the switch is a subtle transition, or instant when reduced motion is requested.

---

### User Story 2 - Replace or remove a file while editing (Priority: P2)

A content editor editing an item picks a new file for one of its content attributes (or removes the existing file), checks the new file in the preview, and saves. The item now holds the new file, and its file name and media type match it.

**Why this priority**: Replacing a wrong or outdated document is the second most common edit and belongs in the edit form rather than in a separate control on the detail page. It depends on Story 1's form and save flow.

**Independent Test**: Open a fixture item with a content attribute holding a PDF. Choose Edit, pick a different PDF for that attribute, save. The preview and download now deliver the new file, the displayed file name is the new one, and all other attribute values are unchanged.

**Acceptance Scenarios**:

1. **Given** the form is open for an item with content attributes, **When** it renders, **Then** each content attribute shows its current file (name, type) and offers to pick a new file (browse or drag and drop) or remove the current one.
2. **Given** the user picks a new file for a content attribute, **When** nothing has been saved yet, **Then** nothing is sent to the server, the attribute shows the picked file, its file name and media type values follow the picked file, and in the content-focus layout the preview switches to the picked file.
3. **Given** the user has picked a file, **When** they pick another one or remove it again before saving, **Then** only the last choice is kept.
4. **Given** the user removes a file, **When** they save, **Then** the content attribute is empty afterwards.
5. **Given** the user has changed attribute values and picked a new file, **When** they save, **Then** the attribute values are saved first, then the file is uploaded with visible progress, and only when everything is done does edit mode close and the page show the new state.
6. **Given** the user edits only a file's name (without picking a new file), **When** they save, **Then** the file keeps its content and is shown and downloaded under the new name.
7. **Given** the user saves attribute changes without touching any file, **When** the save completes, **Then** every existing file is still attached with its original name and type.
8. **Given** the user has picked a new file, **When** they cancel and confirm, **Then** nothing is uploaded and the preview returns to the stored file.

---

### User Story 3 - Recover from a failed save (Priority: P3)

A content editor saves and something goes wrong: a value is rejected, someone else changed the item in the meantime, their permissions changed, or an upload fails. They see what happened, next to the field when it is about a field, and can fix it without losing their input.

**Why this priority**: Failures are rarer than successful saves, but losing typed input or silently overwriting a colleague's change is the most damaging outcome of an edit feature.

**Independent Test**: With mocked API responses, trigger each failure (field validation, conflicting change, forbidden, unexpected error, failed upload) on save. Each shows its message in the right place, the user's input is kept, and a retry succeeds once the cause is removed.

**Acceptance Scenarios**:

1. **Given** the server rejects one or more values, **When** the save returns, **Then** each rejected field shows its message inline, the form stays open with all input kept, and messages not tied to a field are shown above the form.
2. **Given** the item was changed by someone else since the form was opened, **When** the user saves, **Then** the save is refused without overwriting the other change and the user is told the item has been updated by someone else. Saving is not possible until they refresh; Refresh reloads the latest version into the form.
3. **Given** the user is no longer allowed to update the item (or the change would move it outside what they may update), **When** they save, **Then** the form stays open with their input and a message explains the update is not permitted.
4. **Given** the item no longer exists, **When** the user saves, **Then** they are told the item was not found and edit mode offers only to leave.
5. **Given** attribute values saved but a file upload or removal fails, **When** the save finishes, **Then** edit mode stays open, the saved values are kept, and the failed file is flagged on its attribute with the reason and a retry; retrying applies only the file steps that failed.
6. **Given** any save is in progress, **When** it has not finished, **Then** Save cannot be triggered twice and the user can see that saving is under way.

---

### Edge Cases

- An item whose update form has no properties (every attribute is system-managed): Edit is not offered, since there is nothing to change.
- Attributes that are not part of the update form (for example audit fields such as created by / modified date) are not shown as inputs; they stay visible as read-only values on the page.
- An allowed-values attribute whose current value is no longer in the allowed list: the current value is kept and shown, and saving without touching it does not fail on the client.
- A multi-value allowed-values attribute with no current values: shown empty, not with a placeholder value.
- Date and datetime values keep their meaning across time zones: a date-only attribute never shifts by a day, a datetime is shown in the user's local time and saved unchanged when untouched.
- A file upload is still in progress (started outside edit mode) when the user chooses Edit: that upload continues and its outcome is shown; the form does not queue a second change for the same attribute unless the user picks a new file.
- The user picks a file whose media type the browser cannot determine: the media type value is left as the user or the server sets it, never invented.
- Very large files: upload progress is shown and the page stays responsive; the user can still cancel before the upload starts.
- The user loses network during save: the save reports failure as in Story 3 and the input is kept.
- The user's session expires while the form is open: saving re-authenticates or reports the problem without discarding the input.
- Two content attributes changed in one save: each file change is applied and reported separately.

## Requirements _(mandatory)_

### Functional Requirements

**Entry and gating**

- **FR-001**: The item detail page MUST offer an Edit action when, and only when, the API publishes an update form for that item for the current user.
- **FR-002**: The Edit action MUST NOT be offered where the item is shown read-only inside another view (for example an item preview inside search results or inside another item's relation).
- **FR-003**: The edit form MUST be available in both the attribute-focus and the content-focus layouts of the item page. It MUST open in place of the item's attribute panel, with no page change, dialog or overlay: the item header, the relation sections and (in the content-focus layout) the preview stay where they are.
- **FR-003a**: Switching between viewing and editing MUST feel continuous: each attribute keeps its position, and the change between read-only values and inputs is a short, subtle transition that is skipped when the user has asked for reduced motion.
- **FR-003b**: Save and Cancel MUST stay reachable without scrolling while the form is open, in an action bar pinned to the bottom of the panel. The panel MUST show that it is in edit mode (a clear heading such as "Editing <item name>") and whether there are unsaved changes.
- **FR-003c**: The form MUST follow the Horizon look and feel of the item page and the create form: the same spacing, typography, input styles, colour tokens, light and dark themes, and keyboard focus order; it MUST work at phone width without horizontal scrolling.

**Form content**

- **FR-004**: The form MUST be generated from the item's update form at runtime, without any entity-specific or attribute-name-specific code, and MUST show every property that form offers, in the order it offers them.
- **FR-005**: The form MUST support every attribute type the create form supports (text, email, number, boolean, date, datetime, single and multiple allowed values, content) and MUST render each with the same input and behaviour as on the create form.
- **FR-006**: Every input MUST be pre-filled with the item's current value, read from the item itself (the update form carries no values).
- **FR-007**: Required properties MUST be marked with `*` and validated on the client before any request is sent, exactly as on the create form.

**Content attributes**

- **FR-008**: Each content attribute MUST show its current file and let the user pick a replacement (browse and drag and drop) or remove the current file.
- **FR-009**: Picking or removing a file MUST only record a pending change; no file request is sent before the user saves.
- **FR-010**: When a file is picked, the attribute's file name and media type values in the form MUST follow the picked file; when a pending change is withdrawn, they MUST return to the stored file's values.
- **FR-011**: In the content-focus layout, the preview MUST switch to a picked file while it is pending, and back to the stored file when the change is withdrawn or cancelled.
- **FR-012**: The user MUST be able to edit a content attribute's file name without replacing the file.

**Saving**

- **FR-013**: Save MUST send the item's attribute values using the method, address and content type the update form specifies; nothing about the request may be hard-coded.
- **FR-014**: Because the update replaces the item's values, the save MUST send every property of the form, and for content attributes with a pending file change it MUST send the stored file's name and media type, so that a failed upload never leaves the item describing a file it does not hold.
- **FR-015**: After the attribute values are saved, each pending file change MUST be applied one at a time (upload for a picked file, removal for a removed file) through the content attribute's own address, showing upload progress. An uploaded file MUST carry the file name shown in the form.
- **FR-016**: Edit mode MUST close only after every step has finished and the item has been reloaded, so the page never shows the old values after a successful save.
- **FR-017**: A successful save MUST be confirmed with a short notification naming the entity, in the same style as the create form's confirmation.
- **FR-018**: Every save MUST be conditional on the item not having changed since the form was opened; a conflicting change MUST never be silently overwritten.
- **FR-019**: While a save is in progress, Save MUST be disabled and the progress visible.

**Cancelling**

- **FR-020**: Cancel MUST discard all pending attribute and file changes. If there are unsaved changes, cancelling or navigating away MUST ask for confirmation first.

**Failures**

- **FR-021**: Server validation messages tied to a field MUST be shown on that field; messages not tied to a field MUST be shown above the form. The user's input MUST be kept.
- **FR-022**: A refused update (not permitted, or the result would not be permitted) MUST keep the form open with the input and explain that the update is not allowed.
- **FR-023**: A conflicting change MUST be reported as such, and saving MUST NOT be possible until the user refreshes. Refresh MUST reload the latest version into the form, after which saving again is conditional on that version.
- **FR-024**: A failed file step MUST be shown on the affected content attribute with a retry, and MUST NOT undo the attribute values already saved. Edit mode MUST stay open until every file step has succeeded or the user cancels; a retry MUST apply only the steps that failed.
- **FR-025**: An item that no longer exists MUST be reported as not found, without offering to save again.

### Key Entities

- **Entity item**: One stored instance of an entity (for example one invoice). Holds attribute values, a version marker used to detect concurrent changes, and the forms that say what the current user may do with it.
- **Update form**: The form the API publishes on an item when the current user may update it. Lists the editable properties (name, type, required, allowed values) and how to submit them. Its presence is what makes an item editable.
- **Content attribute**: An attribute holding one file. Has file metadata (name, media type, size) that appears in the update form as two editable values, and its own address for uploading or removing the file itself.
- **Pending file change**: A user's not-yet-saved decision to replace or remove the file of one content attribute during an edit. At most one per content attribute; discarded on cancel, applied on save.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every entity in the recorded demo model and the HAL-FORMS item fixtures, an editable item can be opened in edit mode with every update-form property shown and correctly pre-filled (100% of properties, verified by automated tests).
- **SC-002**: A user can change one attribute of an item and see the saved value on the page in under 5 seconds on a normal connection, excluding file upload time.
- **SC-003**: Saving an item without touching any value leaves every attribute and every attached file unchanged (verified for all fixture entities).
- **SC-004**: No save ever overwrites a concurrent change made by someone else (verified by an automated conflict scenario).
- **SC-005**: In every failure scenario of Story 3 except a conflict, the user's typed input is still present after the failure (0 cases of lost input); on a conflict, Refresh replaces it with the latest version.
- **SC-006**: The Edit action is shown for 0 items the user is not permitted to update, across all fixture entities.
- **SC-007**: Every behaviour of the original Navigator's edit flow for attributes and files (`research.md` §1) has an equivalent here, or is listed under Out of scope with a reason.

## Assumptions

- The API publishes the update form on each item the user may update, and omits it otherwise; its absence is the only permission signal the frontend needs.
- The update replaces all of the item's attribute values (it is not a partial update), which is why every property is sent.
- File metadata (name, media type) is edited through the update form, while file bytes are uploaded or removed through the content attribute's own address, as on the platform today.
- The item's version marker is available when the item is loaded and is accepted by the API as a precondition on update; a mismatch is reported with the platform's "unsatisfied version" problem.
- The create form's inputs, validation, required-field marking and error display are reused as they are, so both forms look and behave the same.
- Uploading a file into an empty content attribute outside edit mode keeps working as specified elsewhere; this feature does not change it.
- The Horizon design mockup for the item page is the reference for placement and styling; where it has no edit screen, the existing Horizon create form and item page patterns apply.

### Dependencies and references

- The `hal-forms` feature — field renderers, field state and the file renderer with upload progress, shared with the create form.
- `VersionConflictAlert` — the "unsatisfied version" conflict message.
- The item page's relation sections (link/unlink), which stay the place to edit relations.
- Audit `docs/audits/phase-5d7-workitems.md`, WI-20 — update-form shape and content-attribute dual representation.
- `specs/002-pdf-viewer` — content-focus layout and the "No file" drop area.
