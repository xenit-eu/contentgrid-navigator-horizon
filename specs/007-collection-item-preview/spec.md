# Feature Specification: Item Preview in the Entity Collection

**Feature Branch**: `007-collection-item-preview`

**Status**: Draft

**Input**: Clicking a row in an entity collection previews that item without leaving the list. On a wide screen the preview opens in a resizable pane beside the table; on a narrow screen it opens in a dialog. The pane shows the item's content preview, and its attributes and relations on request. The row's View action still opens the item's own page.

## Scope

**In scope**

- Previewing the clicked row's item from the entity collection page: its content, attributes and relations, read-only.
- A resizable side pane beside the table on wide screens and a preview dialog on narrow screens.
- Choosing which content attribute the pane previews when the entity has several.
- Keeping the pane in step with the table: the previewed row is highlighted, and deleting the previewed item closes the pane.
- The table's Columns and Filters actions as icon buttons in the actions column's header.

**Out of scope**

- Editing in the pane: uploading content, linking or unlinking relations and deleting related items stay on the item's own page.
- Opening the preview or the details in a separate browser window.
- Keeping the previewed item in the page URL: reloading or sharing the page does not reopen the pane.
- Previewing from a relation's item list on the item page.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Preview a row beside the table (Priority: P1)

A user on a wide screen browses invoices. Clicking a row opens its PDF in a pane beside the table; clicking another row shows that one instead, without leaving the list.

**Why this priority**: Going through a list item by item is the main reason to open the collection; going to each item's page and back loses the user's place.

**Independent Test**: On a screen at least 1200 px wide, open a collection of an entity with a content attribute and click a row: the pane opens beside the table with that item's file, and the table stays usable.

**Acceptance Scenarios**:

1. **Given** a screen at least 1200 px wide, **When** the user clicks a row, **Then** a pane opens beside the table showing the item's reference, its content preview and a **Close** button, and the row is highlighted.
2. **Given** the pane is open, **When** the user clicks another row, **Then** the pane shows that item and its row is highlighted instead.
3. **Given** the pane is open, **When** the user drags the handle between table and pane, **Then** both resize, neither below its minimum width; **When** the user drags the pane shut, **Then** it closes as with **Close**.
4. **When** the user uses a row's **View** action, **Then** the item's own page opens, whether or not the pane is open.
5. **Given** the pane is open, **When** the user deletes the previewed item from its row, **Then** the pane closes; deleting another row's item leaves it open.

---

### User Story 2 - Read the item's details in the pane (Priority: P1)

The pane shows the content preview first. A **Details** tab shows the item's attributes and relations over it; **Preview** returns to the file where it was left.

**Why this priority**: Checking an item usually means comparing its file with its fields; both must be reachable from the pane.

**Independent Test**: Open the pane on an item with a content attribute, switch to **Details**: its attributes and relations are listed; switch back to **Preview**: the PDF is still on the same page.

**Acceptance Scenarios**:

1. **Given** an entity with at least one content attribute, **Then** the pane offers **Preview** and **Details** tabs, starting on **Preview**.
2. **When** the user switches to **Details**, **Then** the pane lists the item's attributes and its relations; a long value wraps instead of widening the pane.
3. **When** the user switches back to **Preview**, **Then** the preview is as it was left (a PDF on the same page and zoom).
4. **Given** an entity without content attributes, **Then** the pane shows the attributes and relations only, with no tabs.
5. **Given** the details are shown, **Then** relations show no Link, Unlink, Unlink all or Delete action, and related items are not links.
6. **Given** the pane previews an attribute that holds no file, **Then** it shows "No file uploaded yet" without a drop zone, even when the user may upload.

---

### User Story 3 - Choose which content to preview (Priority: P2)

An entity has several content attributes. The pane starts on the one that holds a file, and the user can switch between them; the choice carries over to the next row.

**Why this priority**: Only some entities have several content attributes.

**Independent Test**: Open the pane on an entity with two content attributes, choose the second, then click another row: the pane still shows the second attribute.

**Acceptance Scenarios**:

1. **Given** several content attributes, **Then** the preview's toolbar offers a selector listing them, starting on the first that holds a file (or the first, if none does).
2. **When** the user chooses another attribute, **Then** the preview shows it; **When** the user clicks another row, **Then** the pane keeps that attribute.
3. **Given** the **Details** tab is shown, **When** the user clicks another row, **Then** the pane stays on **Details**.

---

### User Story 4 - Preview on a narrow screen (Priority: P2)

On a screen narrower than 1200 px there is no room beside the table, so a row click opens the same preview in a dialog.

**Why this priority**: Narrow screens still need the preview, but it must not squeeze the table.

**Independent Test**: On a screen narrower than 1200 px, click a row: a dialog opens with the same preview and tabs as the pane.

**Acceptance Scenarios**:

1. **Given** a screen narrower than 1200 px, **When** the user clicks a row, **Then** a dialog opens with the item's preview, as in Stories 2 and 3.
2. **When** the user presses **Close**, presses Escape or clicks outside the dialog, **Then** it closes.
3. **Given** the pane or the dialog is open, **When** the window is resized across 1200 px, **Then** the preview closes; it does not move between pane and dialog.

---

### Edge Cases

- The host gives no way to open an item's page → rows cannot be clicked and no View action is shown, so there is no preview.
- The table scrolls sideways under the sticky actions column → the actions column's cells are opaque, so no row content shows through, and follow the row's hover colour.
- The pane is closed → its panel stays collapsed beside the table, so opening it again does not reload the table.

## Requirements _(mandatory)_

### Functional Requirements

**Layout**

- **FR-001**: From a viewport width of 1200 px, a row click MUST open the preview in a pane beside the table; below it, in a dialog.
- **FR-002**: The pane MUST open at 45 % of the width, be resizable, keep the table at least 320 px and the pane at least 360 px wide, and close when dragged shut.
- **FR-003**: Resizing the window across 1200 px MUST close the preview.

**Selection**

- **FR-004**: A row click MUST preview that row's item and highlight its row; the row's View action MUST open the item's own page.
- **FR-005**: Deleting the previewed item MUST close the preview; deleting another item MUST NOT.

**Pane content**

- **FR-006**: For an entity with content attributes, the pane MUST offer a content preview and a details view, keeping the preview mounted while the details are shown.
- **FR-007**: The pane MUST start on the first content attribute holding a file, and keep the chosen attribute and the chosen view for the next row.
- **FR-008**: The pane MUST NOT offer any edit: no content upload and no relation Link, Unlink, Unlink all or Delete.

**Table**

- **FR-009**: When the table has an actions column, its Columns and Filters actions MUST sit in that column's header as icon buttons with tooltips.

### Key Entities

- **Previewed item**: the entity item whose row was clicked last; none while the preview is closed.
- **Previewed content attribute**: the content attribute the pane shows; chosen by the user or defaulted from the item.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On a wide screen, an item's file is visible one click after the collection has loaded, without leaving the list.
- **SC-002**: Moving to the next item in the list takes one click, with the chosen attribute and view kept.
- **SC-003**: No edit action is reachable from the pane.

## Assumptions

- The split breakpoint is the one the create form's file preview uses (`006-create-form-file-preview`).
- On a narrow screen a dialog is preferred over opening the item's page, so the user keeps their place in the list.

### Dependencies and references

- **`002-pdf-viewer`**: the content preview and its states.
- **`006-create-form-file-preview`**: the split breakpoint and the reusable content preview pieces.
