# Feature Specification: Create Item Page and Upload into Empty Content Attributes

**Feature Branch**: `004-create-item-page`

**Created**: 2026-09-30

**Status**: Draft

**Input**: A general "Create Item" page opened from the sidebar Create button, where the user can optionally attach a file and selects the entity to create, which opens that entity's create form (design mockup page 05). The existing entity selector becomes a reusable pattern, like the attribute selector. The "No file" drop zone of the content-focus viewer uploads into empty content attributes.

**Research**: [`research.md`](research.md) records how the original Navigator implements this today and the current state of the code this feature builds on. It is input to `/speckit-plan`, not part of the requirements.

## Scope

**In scope**

- A "Create Item" page, reached from the sidebar **Create Item** button, where the user chooses the entity to create and may attach one file.
- Continuing from that page into the chosen entity's existing create form, with the attached file already in the form's first file field.
- Switching the entity from the toolbar of an entity's create form, keeping the attached file.
- A reusable entity selector that shows each entity's icon, name and description and marks the selected one, built from the existing entity selector and consistent with the attribute selector.
- Uploading a file into an empty content attribute from the "No file" drop zone of the content-focus item page, and showing the uploaded file in the viewer afterwards.

**Out of scope** (tracked elsewhere or deferred)

- Suggesting the entity type from the uploaded file (classification / extraction). A follow-up story.
- The create form itself: its fields, validation, required-field markers, continuous-create mode, relation pickers and submission are unchanged.
- Replacing or removing a file that is already stored: the edit form (`003-add-edit-form`).
- Uploading several files at once, or into a multi-valued content attribute.
- Previewing the attached file on the Create item page.
- Upload progress percentage on the item page.
- Client-side file type or size limits: the model does not publish them, so the mockup's "PDF, DOCX, PNG up to 20 MB" hint is not shown.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Choose what to create from the general Create page (Priority: P1)

A user clicks **Create Item** in the sidebar, chooses the kind of item to create and presses **Continue**; its create form opens.

**Why this priority**: It is the entry point the sidebar button promises; today the button goes to the dashboard. Without it no other story on this page is reachable.

**Independent Test**: With fixtures that allow creating two entities and deny a third, open the Create item page from the sidebar: exactly the two permitted entities are offered, and choosing one and pressing **Continue** opens its create form.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they click **Create Item** in the sidebar, **Then** the Create Item page opens with the title "Create Item", the subtitle "Select the entity you want to create." and an **Entity** field.
2. **Given** the application has several entities, **When** the Create Item page opens, **Then** the **Entity** list shows only the entities the user may create, each with its icon, name and description, in the same order as the sidebar.
3. **Given** no entity is chosen, **Then** **Continue** is disabled; **When** the user chooses an entity and presses **Continue**, **Then** that entity's create form opens.
4. **Given** the user presses **Cancel**, **Then** they return to the page they came from and nothing is created.
5. **Given** exactly one entity can be created, **Then** the **Entity** field still shows it so it can be chosen.

---

### User Story 2 - Start the create form with a file already attached (Priority: P1)

A user drops a file on the Create item page, then chooses the entity and presses **Continue**. The create form opens with the file already in its file field, ready to submit.

**Why this priority**: Most items are created around a document; attaching it once on the first screen removes a second upload step. It is the reason the page has a drop zone.

**Independent Test**: Attach a PDF on the Create item page, then choose an entity with a file field and press **Continue**: the create form shows the PDF in its file field, and submitting creates the item with the file stored.

**Acceptance Scenarios**:

1. **Given** the Create item page, **When** the user drops a file on **Upload a file (optional)** or chooses one with **browse**, **Then** the file's name and size are shown and the file can be removed again.
2. **Given** a file is attached, **When** the user chooses an entity whose create form has a file field and presses **Continue**, **Then** the create form opens with that file in its first file field.
3. **Given** a file is attached, **When** the user chooses an entity whose create form has no file field and presses **Continue**, **Then** the create form opens without the file and without any message; the file stays attached for a later create form that has a file field.
4. **Given** the create form opened with an attached file, **When** the item is created successfully, **Then** the attached file is cleared and the next create form (including continuous-create mode) starts without it.
5. **Given** no file is attached, **Then** the create form opens exactly as when it is opened from the entity's list page.
6. **Given** the create form opened with an attached file, **When** the user removes it in the form, **Then** it is cleared and does not come back on any later create form.
7. **Given** a file is attached, **When** the user reloads the page, **Then** the file is gone (it is held in memory only).

---

### User Story 3 - Upload a file into an empty content attribute (Priority: P2)

A user opens an item whose content attribute holds no file. The viewer area shows the drop zone; the user drops a file, it uploads, and the viewer shows it.

**Why this priority**: The drop zone is already shown for empty content attributes (spec `002-pdf-viewer`, Story 1 scenario 5) but does nothing yet. It is independent of the Create item page.

**Independent Test**: Open a fixture item with an empty content attribute and drop a PDF on the drop zone: an uploading state is shown, then the PDF renders in the viewer and the item's file details are updated.

**Acceptance Scenarios**:

1. **Given** a content attribute with no file that the user may upload to, **When** the user drops a file on the drop zone or chooses one, **Then** the file is uploaded to that attribute and an "Uploading…" state replaces the drop zone.
2. **Given** the upload succeeds, **Then** the viewer shows the new file (a PDF directly, other types through their rendition) and the item's details show the new file's name, size and type, without a manual reload.
3. **Given** the upload fails, **Then** the error is shown with its title and detail, and the drop zone is offered again.
4. **Given** the item was changed by someone else in the meantime, **When** the upload is refused for that reason, **Then** the user is told the item was modified, the item is reloaded, and nothing is retried automatically.
5. **Given** the user may not upload to that content attribute, **Then** only "No file" is shown, without a drop zone.
6. **Given** an item with several content attributes, **When** the user switches to another empty one and drops a file, **Then** the file goes to the attribute currently selected.
7. **Given** an upload is in progress, **Then** the user cannot start a second upload into the same attribute.

---

### User Story 4 - Switch entity from the create form (Priority: P2)

On an entity's create form, the toolbar shows the same entity selector. The user realises they picked the wrong kind of item and switches; the create form of the other entity opens, and an attached file follows.

**Why this priority**: Recovers from a wrong choice without going back, and is the second place that uses the reusable entity selector. The create form works without it.

**Independent Test**: Attach a file on the Create item page, choose entity A and press **Continue**, then switch to entity B in the toolbar: B's create form opens with the file in its file field.

**Acceptance Scenarios**:

1. **Given** an entity's create form, **Then** the toolbar shows the entity selector with the current entity selected, listing the same entities as the Create item page.
2. **Given** the create form has no unsaved changes, **When** the user chooses another entity, **Then** that entity's create form opens at once.
3. **Given** the create form has unsaved changes, **When** the user chooses another entity, **Then** the existing unsaved-changes confirmation is shown first.
4. **Given** a file is attached, **When** the user switches to an entity with a file field, **Then** the file is in its first file field; switching to one without a file field keeps the file for later.

---

### Edge Cases

- The model offers no entity the user may create → the Create item page says there is nothing the user can create, instead of showing an empty list.
- The user drops several files at once on either drop zone → only the first is used.
- The user attaches a file, chooses entity A, then switches or goes back and chooses entity B → the file goes to B's form; only the item that is actually created stores it.
- The user attaches a file, chooses an entity, and cancels the create form → the file stays attached and is offered again on the next create form with a file field, until an item is created or the user removes it.
- The user chooses an entity and presses **Continue** without attaching a file first → the create form opens without a file; the user attaches it in the form.
- The user navigates away while a file is uploading on the item page → the upload is not shown elsewhere; on return the item shows whatever the server has.
- The entities are still loading → the page shows a loading state, not an empty list.
- The user opens the Create item page directly by URL without having been there before → Cancel goes to the dashboard.

## Requirements _(mandatory)_

### Functional Requirements

**Create item page**

- **FR-001**: The sidebar **Create Item** button MUST open the Create item page.
- **FR-002**: The page MUST offer only entities for which the model publishes a create form for the current user; no entity is hardcoded.
- **FR-003**: Each offered entity MUST show the icon and colour configured for it in the Navigator display settings, and its name and description from the model.
- **FR-004**: Choosing an entity MUST mark it as selected; **Continue** MUST be disabled until an entity is chosen and MUST then open that entity's existing create form.
- **FR-005**: **Cancel** MUST return to the previous page, or to the dashboard when there is none.
- **FR-006**: The page MUST show a loading state while entities load and an explicit message when no entity can be created.

**Attached file**

- **FR-007**: The page MUST accept one optional file by drag and drop or by browsing, and allow removing it.
- **FR-008**: An attached file MUST be held in memory only (never in the address bar or browser storage) and MUST stay attached across entity choices until an item is created successfully or the user removes it.
- **FR-009**: The attached file MUST fill the first file field of the create form, in the form's own field order.
- **FR-010**: When the chosen entity's create form has no file field, the create form MUST open without the file and without a message, and the file MUST stay attached.

**Entity selector**

- **FR-011**: The entity selector MUST be a reusable pattern, derived from the existing entity selector, that shows for each entity an icon, a name and an optional description, and marks the selected entity.
- **FR-012**: The entity selector MUST show any number of entities, including one, and MUST be operable by keyboard and labelled for assistive technology.
- **FR-013**: The entity selector MUST follow the attribute selector's visual structure (field label above, compact selected value, rich option rows).

**Entity switch on the create form**

- **FR-020**: The create form's toolbar MUST show the entity selector (same entities, current one selected); choosing another entity MUST open its create form.
- **FR-021**: Switching entity with unsaved changes MUST go through the existing unsaved-changes confirmation.

**Upload into an empty content attribute**

- **FR-014**: The "No file" drop zone MUST be shown only when the user may upload to that content attribute; otherwise only "No file" is shown.
- **FR-015**: A file chosen on the drop zone MUST be uploaded to the content attribute currently selected in the viewer.
- **FR-016**: The upload MUST be refused by the server rather than overwrite a newer version of the item; when that happens the item MUST be reloaded and the user told.
- **FR-017**: While uploading, the drop zone MUST be replaced by an uploading state that prevents a second upload.
- **FR-018**: After a successful upload the viewer and the item's details MUST show the new file without a manual reload.
- **FR-019**: A failed upload MUST show the server's problem (title and detail) and offer the drop zone again.

### Key Entities

- **Entity option**: one entity as the selector shows it — its name (identity), display title, optional description and icon.
- **Pending create file**: the file attached on the Create item page; exists from attaching until an item is created or the user removes it.
- **Empty content attribute**: a content attribute of an item with no file stored, together with whether the user may upload to it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can go from the sidebar to a create form with an attached file in at most four actions (open Create, attach file, choose entity, **Continue**).
- **SC-002**: In every tested model, no entity without a create form is offered on the Create item page (0 occurrences).
- **SC-003**: After a successful upload into an empty content attribute, the file is shown in the viewer without a manual reload in 100 % of test runs.
- **SC-004**: After a successful create, the attached file is gone from every later create form (0 occurrences across the unit tests). The e2e suite is disabled in CI until the application is feature-complete, so this is not checked end-to-end yet.
- **SC-005**: The entity selector is used in two places — the Create Item page and the create form's toolbar — with no page-specific changes to the pattern.

## Assumptions

- The mockup layout is kept: Entity list above the upload area, **Cancel** and **Continue** below. The application logo is not shown on the page.
- The entity order on the page is the order of the sidebar entity list.
- The Create item page is reachable in both the generic and the experimental Navigator.

### Dependencies and references

- **Create-form file field**: Story 2 prefills the create form's existing file field.
- **`002-pdf-viewer`**: the "No file" state and its drop zone (Story 1 scenario 5, `contracts/content-focus-view.md`).
- **`003-add-edit-form`**: owns replacing and removing stored files; explicitly excludes this feature's empty-attribute upload.
- Design mockup page 05 ("Classify · Create", `/create`, `ClassifyCreateInstancePage`).
