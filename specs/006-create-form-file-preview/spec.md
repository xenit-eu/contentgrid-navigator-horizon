# Feature Specification: File Preview on the Create Form

**Feature Branch**: `006-create-form-file-preview`

**Status**: Draft

**Input**: Show the file picked in a create form's file field before the item is created. On a wide screen the preview sits beside the form; on a narrow screen it opens in a dialog. The preview handles every kind of PDF, including a password-protected one, and images and videos as they are.

## Scope

**In scope**

- Previewing the file picked in any file field of an entity's create form, before anything is uploaded.
- A side-by-side layout on wide screens (preview beside the form) and a preview dialog on narrow screens.
- Choosing which file field the preview shows when the form has several.
- Dropping a file on the empty preview to fill the previewed file field.
- Opening a password-protected PDF by entering its password, in every PDF preview (the create form and the content-focus item page).

**Out of scope**

- Uploading the file before the item is created: the file is sent with the create request only (`004-create-item-page`).
- Previewing types that need the platform's rendition service: a picked file has not been uploaded, so there is nothing to convert.
- Multi-valued file fields.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See the picked file next to the form (Priority: P1)

A user on a wide screen opens a create form with a file field and picks a PDF. The PDF shows beside the form while they fill in the other fields.

**Why this priority**: Filling in an item's fields usually means reading them off its document; without the preview the user has to open the file elsewhere.

**Independent Test**: On a screen at least 1200 px wide, open a create form with one file field, pick a PDF: it renders in the panel beside the form, and the form's own fields stay usable.

**Acceptance Scenarios**:

1. **Given** a screen at least 1200 px wide and a create form with a file field, **Then** a file preview area is shown beside the form, previewing the first file field.
2. **Given** no file is picked in the previewed field, **Then** the preview area is a drop zone filling the area; **When** the user drops a file on it, **Then** the file goes into the previewed field and is shown.
3. **Given** the previewed field is read-only, **Then** the empty preview shows "No file" without a drop zone.
4. **Given** the preview is beside the form, **Then** each file field's empty drop zone is a single line ("No file chosen", **Choose file**), since the preview is the large drop area, and no file field shows a "Preview file" button.
5. **Given** the form is taller than the page, **Then** only the fields scroll; the error alert above them and the **Create** / **Cancel** actions below stay in view, and the preview scrolls on its own.

---

### User Story 2 - Preview every kind of picked file (Priority: P1)

The preview shows a PDF in the PDF viewer and an image or video as it is. A protected PDF asks for its password. Any other type, or a file that cannot be opened, says so.

**Why this priority**: The preview is only useful when it shows the file the user actually picked, whatever kind it is.

**Independent Test**: Pick, in turn, a valid PDF, a password-protected PDF, a corrupt PDF, a PNG, an MP4 and a `.txt` file: each shows the outcome listed below.

**Acceptance Scenarios**:

1. **Given** a picked PDF, **Then** it renders in the PDF viewer with page navigation, zoom, search, print, fullscreen and download.
2. **Given** a picked password-protected PDF, **Then** the viewer shows "This document requires a password to open" with a password input and **Submit**; **When** the right password is submitted, **Then** the document opens; **When** a wrong one is submitted, **Then** the viewer says the password is wrong and asks again.
3. **Given** a picked PDF that is corrupt, or that can no longer be read from the device, **Then** the preview shows "The document is invalid or corrupted".
4. **Given** a picked image or video, **Then** it is shown as it is (an image fits the area until the user switches to its actual size; a video plays with the browser's controls).
5. **Given** a picked image or video the browser cannot open, **Then** the preview says the browser can't open this image or video.
6. **Given** a picked file of any other type, **Then** the preview shows "Preview isn't available for `<type>` files."
7. **Given** the PDF viewer fails to start, **Then** the preview shows the viewer failure with **Retry**, which starts the viewer again.

---

### User Story 3 - Choose which file field to preview (Priority: P2)

A create form has several file fields. The preview follows the field the user is working on, and the user can also switch it by hand.

**Why this priority**: Only some entities have several file fields; with one, the preview never needs switching.

**Independent Test**: On a wide screen, open a create form with two file fields: the preview starts on the first; picking a file in the second switches the preview to it.

**Acceptance Scenarios**:

1. **Given** several file fields, **Then** the preview's toolbar offers a selector listing them by label, with the previewed one selected; **When** the user chooses another, **Then** the preview shows that field.
2. **When** the user picks a file in a file field, **Then** the preview switches to that field.
3. **When** the user focuses a file field on a wide screen, **Then** the preview switches to that field.
4. **Given** several file fields on a wide screen, **Then** the previewed field is highlighted in the form; with one file field there is nothing to tell apart and no highlight.

---

### User Story 4 - Preview on a narrow screen (Priority: P2)

On a screen narrower than 1200 px there is no room beside the form, so a picked file gets a **Preview file** button that opens the preview in a dialog.

**Why this priority**: Narrow screens still need the preview, but it must not squeeze the form.

**Independent Test**: On a screen narrower than 1200 px, pick a file in the second of two file fields and press its **Preview file** button: a dialog opens previewing that field.

**Acceptance Scenarios**:

1. **Given** a screen narrower than 1200 px, **Then** no preview is shown beside the form, and each file field with a picked file shows a **Preview file** button.
2. **When** the user presses a field's **Preview file** button, **Then** a "Preview file" dialog opens previewing that field, with the same selector and behaviour as Stories 2 and 3.
3. **Given** the dialog is open, **When** the window is widened past 1200 px, **Then** the dialog closes and the preview is shown beside the form; narrowing the window again does not reopen it.

---

### Edge Cases

- The create form has no file field → no preview and no layout change; the form looks exactly as without this feature.
- The create form opens with a file attached on the Create item page (`004-create-item-page`) → the preview shows that file in the first file field.
- The user removes the picked file → the preview shows the empty state for that field.
- Continuous-create mode, after a successful create → the form resets and the preview returns to the first file field.
- An empty preview that offers a drop zone shows no "No file" caption, as the drop zone already says there is no file; this holds for every content preview, the content-focus item page included. The caption shows only where the user cannot upload.
- The user picks a different file in the previewed field → the preview starts over for the new file; nothing from the previous file (an error, a password) carries over.
- The window is resized across 1200 px → only one preview (beside the form or in the dialog) exists at a time, so the file is read and the PDF engine started once.

## Requirements _(mandatory)_

### Functional Requirements

**Layout**

- **FR-001**: From a viewport width of 1200 px, a create form with at least one file field MUST show its file preview beside the form; below it, the preview MUST only be reachable through a **Preview file** dialog.
- **FR-002**: Beside the form, only the form's fields MUST scroll; its alert and actions stay in view.
- **FR-003**: Beside the form, the file fields' empty drop zones MUST be a single line, and the previewed field MUST be highlighted when there are several file fields.
- **FR-004**: The preview dialog MUST close when the viewport widens past 1200 px and MUST NOT reopen on its own.

**Previewed field**

- **FR-005**: The preview MUST start on the form's first file field (in the form's own field order) and return to it after a continuous-create reset.
- **FR-006**: The preview MUST switch to a file field when the user picks a file in it, opens its preview, chooses it in the preview's selector, or, beside the form, focuses it.
- **FR-007**: A file dropped on the empty preview MUST fill the previewed field, unless that field is read-only.

**Preview**

- **FR-008**: The preview MUST read the picked file on the device only; nothing is sent to the server before the form is submitted.
- **FR-009**: The preview MUST show a PDF in the PDF viewer (`002-pdf-viewer`), loading the PDF engine only when a PDF is about to be shown, and an image or video as it is.
- **FR-010**: Every PDF preview MUST ask for the password of a protected PDF, open it with the entered password, and say so when the password is wrong; it MUST never try to bypass the protection.
- **FR-011**: The preview MUST show a distinct message for a corrupt or unreadable PDF, an image or video the browser cannot open, a type with no preview, and a viewer failure (with **Retry**).
- **FR-012**: Every preview outcome MUST offer a download of the picked file, except a file that can no longer be read from the device.

### Key Entities

- **File field**: a create-form property of type `file`, with its name and label from the create template.
- **Previewed field**: the one file field the preview shows; starts on the first file field.
- **Picked file**: the file in a file field's value; local to the device until the form is submitted.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On a wide screen, a picked PDF is visible beside the form without any extra action (0 clicks after picking).
- **SC-002**: No request is sent to the server by the preview before the form is submitted (0 requests).
- **SC-003**: A password-protected PDF can be opened in the preview by entering its password, on both the create form and the content-focus item page.
- **SC-004**: Each outcome in Story 2 shows its own message in 100 % of test runs.

## Assumptions

- Below 1200 px the preview moves into a dialog.
- A protected PDF shows "This document requires a password to open"; a wrong password shows "The password is wrong. Please try again".

### Dependencies and references

- **`002-pdf-viewer`**: the PDF viewer, its password prompt (FR-024) and the content preview states the preview reuses.
- **`003-add-edit-form`**: the HAL-Forms file field.
- **`004-create-item-page`**: the create form and the file attached on the Create item page.
