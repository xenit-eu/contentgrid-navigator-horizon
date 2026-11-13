# Feature Specification: Item Preview in the Entity Collection

**Feature Branch**: `007-collection-item-preview`

**Status**: Draft

**Input**: Clicking a row in an entity collection previews that item without leaving the list. When the view is wide the preview opens in a resizable pane beside the table; when it is narrow it opens in a dialog. The pane shows the item's content preview, and its attributes and relations on request. The row's View action still opens the item's own page.

## Scope

**In scope**

- Previewing the clicked row's item from the entity collection: its content, attributes and relations, read-only.
- A resizable side pane beside the table when the view is wide and a preview dialog when it is narrow. The width is the collection's own, so opening or closing the sidebar, or showing the list in a split pane, counts.
- Choosing which content attribute the pane previews when the entity has several.
- Keeping the pane in step with the list: the pane shows the item as it is in the current page of the list, the previewed row is highlighted, and the pane closes when the item leaves that page.
- Operating rows and the preview by keyboard and with a screen reader.
- The table's sticky actions column staying opaque when the table, narrowed by the pane, scrolls sideways.

**Out of scope**

- Editing in the pane: uploading content, linking or unlinking relations and deleting related items stay on the item's own page.
- Opening the preview or the details in a separate browser window.
- Keeping the previewed item in the page URL: reloading or sharing the page does not reopen the pane.
- Previewing from any other table of items: a relation's item list on the item page, a relation field in the create or edit form, and the relation picker keep their own row clicks and actions.
- Where the table's Columns and Filters actions sit: they stay where they are.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Preview a row beside the table (Priority: P1)

A user with a wide view browses invoices. Clicking a row opens its PDF in a pane beside the table; clicking another row shows that one instead, without leaving the list.

**Why this priority**: Going through a list item by item is the main reason to open the collection; going to each item's page and back loses the user's place.

**Independent Test**: With the view at least 880 px wide, open a collection of an entity with a content attribute and click a row: the pane opens beside the table with that item's file, and the table stays usable.

**Acceptance Scenarios**:

1. **Given** a view at least 880 px wide, **When** the user clicks a row, **Then** a pane opens beside the table showing the item's reference, its content preview and a **Close** button, and the row is highlighted.
2. **Given** the pane is open, **When** the user clicks another row, **Then** the pane shows that item and its row is highlighted instead.
3. **Given** the pane is open, **When** the user drags the handle between table and pane, **Then** both resize, neither below its minimum width; **When** the user drags the pane shut, **Then** it closes as with **Close**.
4. **Given** the host can open an item's page, **When** the user uses a row's **View** action, **Then** the item's own page opens, whether or not the pane is open.
5. **Given** the host cannot open an item's page, **Then** rows show no **View** action, and a row click still previews the item.

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

### User Story 4 - Preview in a narrow view (Priority: P2)

When the view is narrower than 880 px there is no room beside the table, so a row click opens the same preview in a dialog.

**Why this priority**: Narrow views still need the preview, but it must not squeeze the table.

**Independent Test**: With the view narrower than 880 px, click a row: a dialog opens with the same preview and tabs as the pane.

**Acceptance Scenarios**:

1. **Given** a view narrower than 880 px, **When** the user clicks a row, **Then** a dialog opens with the item's preview, as in Stories 2 and 3.
2. **When** the user presses **Close**, presses Escape or clicks outside the dialog, **Then** it closes.
3. **Given** the pane or the dialog is open, **When** the view crosses 880 px (a resized window, or the sidebar opened or closed), **Then** the preview closes; it does not move between pane and dialog.

---

### User Story 5 - The pane follows the list (Priority: P1)

The pane always shows the previewed item as the list currently has it. When the item is no longer on the page being shown, there is nothing to preview, so the pane closes.

**Why this priority**: A pane that keeps showing an item that is no longer listed, or with values the list no longer has, misleads the user.

**Independent Test**: Open the pane on a row, then apply a filter that the item does not match: the pane closes when the filtered list is shown.

**Acceptance Scenarios**:

1. **Given** the pane is open, **When** a filter, sort or page change shows a page without the previewed item, **Then** the pane closes.
2. **Given** the pane is open, **When** a filter, sort or page change shows a page that still has the previewed item, **Then** the pane stays open on it.
3. **Given** the pane is open, **When** the list is fetched again and the item has changed (edited in another tab, for example), **Then** the pane shows the new values.
4. **Given** the pane is open, **When** the user deletes the previewed item from its row, **Then** the pane closes; deleting another row's item leaves it open.
5. **Given** the pane is open, **When** the item was deleted elsewhere and the list is fetched again, **Then** the pane closes.

---

### User Story 6 - Keyboard and screen reader (Priority: P1)

A keyboard user moves through the rows with Tab and previews one with Enter or Space. A screen reader tells which row is previewed.

**Why this priority**: Making every row clickable must not make the table harder to use without a mouse.

**Independent Test**: Tab to a row and press Enter: the pane opens, focus stays on the row and the screen reader announces it as current; Tab to its **View** button and press Enter: only the item's page opens.

**Acceptance Scenarios**:

1. **When** the user moves focus with Tab, **Then** each row takes focus, followed by its own buttons; **When** a row has focus and the user presses Enter or Space, **Then** its item is previewed.
2. **Given** focus is on a row's own button (View, Delete) or checkbox, **When** the user presses Enter or Space, **Then** only that control acts; the row is not previewed.
3. **Given** a wide view, **When** the pane opens, **Then** focus stays on the row, so the next row is one Tab away.
4. **Given** a narrow view, **When** the dialog opens, **Then** focus moves into the dialog; **When** it closes, **Then** focus returns to the row that opened it.
5. **Given** focus is inside the pane, **When** the pane closes, **Then** focus returns to the previewed row, or to the table when that row is no longer listed.
6. **Then** the previewed row is marked as the current row (`aria-current`), not only by its colour, and the pane is a region named after the item.

---

### Edge Cases

- The collection has no item page in its host (a list in a pane or in the chat) → rows still preview; only the **View** action is left out.
- The table scrolls sideways under the sticky actions column → the actions column's cells, in the rows and the header, are opaque, so no row content shows through, and follow the row's hover colour.
- The pane is closed → its panel stays collapsed beside the table, so opening it again does not reload the table.
- A new page is loading after a filter, sort or page change → the pane keeps the item until the new page is shown, then closes if the item is not on it.

## Requirements _(mandatory)_

### Functional Requirements

**Layout**

- **FR-001**: From a view width of 880 px, the same `side-by-side` width as the create form's file preview, a row click MUST open the preview in a pane beside the table; below it, in a dialog. The width MUST be the collection's own, never the window's.
- **FR-002**: The pane MUST open at 45 % of the width, be resizable, keep the table at least 320 px and the pane at least 360 px wide, and close when dragged shut.
- **FR-003**: The view crossing 880 px MUST close the preview.

**Selection**

- **FR-004**: A row click MUST preview that row's item and highlight its row, whether or not the host can open item pages. The row's View action MUST open the item's own page, and MUST be shown only when the host can open one.
- **FR-005**: The pane MUST show the previewed item as it is in the current page of the list, and MUST close when the item is no longer in that page (filter, sort or page change, delete here or elsewhere).

**Accessibility**

- **FR-006**: A row MUST be focusable and preview its item on Enter or Space; Enter or Space on a control inside the row MUST NOT also preview it.
- **FR-007**: Opening the pane MUST leave focus on the row; the dialog MUST take focus and return it to the row when it closes; closing the pane while focus is inside it MUST return focus to the previewed row, or to the table when that row is gone.
- **FR-008**: The previewed row MUST carry `aria-current="true"`, and the pane MUST be a region named after the item.

**Pane content**

- **FR-009**: For an entity with content attributes, the pane MUST offer a content preview and a details view, keeping the preview mounted while the details are shown.
- **FR-010**: The pane MUST start on the first content attribute holding a file, and keep the chosen attribute and the chosen view for the next row.
- **FR-011**: The pane MUST NOT offer any edit: no content upload and no relation Link, Unlink, Unlink all or Delete.

### Key Entities

- **Previewed item**: the entity item in the current page of the list whose row was clicked last, found by its self link; none while the preview is closed or once the item is no longer in the page.
- **Previewed content attribute**: the content attribute the pane shows; chosen by the user or defaulted from the item.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With a wide view, an item's file is visible one click (or one Enter) after the collection has loaded, without leaving the list.
- **SC-002**: Moving to the next item in the list takes one click, or Tab and Enter, with the chosen attribute and view kept.
- **SC-003**: No edit action is reachable from the pane.
- **SC-004**: The pane never shows an item, or a value, that the list being shown does not have.

## Assumptions

- The split width is the one the create form's file preview uses (`006-create-form-file-preview`): the `side-by-side` container width, measured on the view, not the window.
- In a narrow view a dialog is preferred over opening the item's page, so the user keeps their place in the list.
- The table's rows are a `table`, not a `grid`, so the previewed row is marked with `aria-current` rather than `aria-selected`.

### Dependencies and references

- **`002-pdf-viewer`**: the content preview and its states.
- **`005-views-layer`**: the collection view places the browser feature; a feature sizes to its own space and leaves through callbacks.
- **`006-create-form-file-preview`**: the split width and the reusable content preview pieces.
