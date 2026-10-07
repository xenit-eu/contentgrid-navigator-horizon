# Feature Specification: Single Search Bar for an Entity Item Collection

**Feature Branch**: `ACC-3199-spec`

**Created**: 2026-10-07

**Status**: Draft — clarified 2026-10-07

**Input**: User description: the handwritten feature description in [`handwritten.md`](handwritten.md) — "The single search bar for an entity item collection is a general search bar that can be used for searching an entityProfile based on the different attributes. The search bar consists of three stacked rows": active search chips, the main search bar (search-parameter selector plus free-text input with a suggestions popover), and quick filters.

## Scope

**In scope**

- One search surface on the entity item collection page, made of three stacked rows: active-filter chips, the main search bar, and quick filters.
- The search-parameter selector, covering every search parameter the entity's search form offers for text (prefix, full-text, exact, allowed values), integer and decimal attributes, on the entity itself and through its relations.
- Search-as-you-type suggestions for prefix and full-text parameters, and client-side suggestions for allowed-value parameters.
- Expected-result counts on parameter chips and suggestion group headers.
- Quick filters for date, date-and-time, boolean, integer, decimal and allowed-value attributes, plus the "created at" and "last modified at" audit attributes.
- Choosing which attributes take part in the search surface through the configuration layer and user preferences, the same way visible table columns are chosen.

**Out of scope**

- Suggesting individual items to jump to, and a sort shortcut on the search surface. Sorting stays with the collection table's own sort control.
- Changes to the existing advanced (multi-field) filter dialog, other than that filters set there are reflected on the search surface.
- New search operators or parameters that the entity's search form does not already offer.
- Configuration of which relation-based search parameters are included: these are always included for now.

## Clarifications

### Session 2026-10-07

- Q: Are item suggestions (jump straight to a matching item) or a quick sort shortcut part of this feature? → A: No. The handwritten description is the full scope.
- Q: Do filters set through a quick filter also appear as chips in the top row? → A: Yes. The chip row lists every active filter from any source; quick-filter buttons show their active state as well.
- Q: Where does a user choose which attributes take part in search? → A: In the existing column/display preferences control, next to the visible-columns choice. No extra control on the search surface.
- Q (after implementation review): Where do the collection's "Columns" and "Filters" buttons go? → A: On the quick-filter row, right-aligned where they were; the quick filters to their left scroll horizontally.
- Q (after implementation review): Does the collection page keep its page title above the search bar? → A: No, it is removed to give the list more height; the breadcrumbs and the table footer's item count remain.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Search across every attribute from one input (Priority: P1)

A user viewing the list of items for one entity (e.g. all invoices) starts typing in the search bar without choosing a parameter first. A popover opens. Its top row lists the search parameters that fit what was typed, each with the number of items it would return. Below, suggested values are listed, grouped per parameter. The user clicks a suggestion; it becomes an active filter chip and the list narrows.

**Why this priority**: This is the core of the feature: a quick way to find items without knowing which attribute holds the value. Everything else builds on it.

**Independent Test**: Open a collection with at least two prefix or full-text searchable attributes, type a value that exists in one of them, and confirm the popover shows the matching parameter chip with a count, a group of suggestions under that parameter, and that clicking a suggestion adds a chip and narrows the list.

**Acceptance Scenarios**:

1. **Given** the selector shows "All" (the default) and the input is empty, **When** the user types one character, **Then** the suggestions popover opens.
2. **Given** the popover is open in "All" mode, **When** suggestions load, **Then** the popover's top row shows one chip per search parameter that matches the input, and the content area shows suggested values grouped under a header per prefix or full-text parameter, with at most 10 values per parameter.
3. **Given** the input is text that is not a number, **When** the parameter chips are shown, **Then** integer and decimal parameters are left out.
4. **Given** the input is a number, **When** the parameter chips are shown, **Then** integer and decimal parameters are listed first and text parameters after them; no text parameter is left out.
5. **Given** a search ran for a parameter, **When** its chip and its group header are shown, **Then** both display the expected number of results for that parameter (exact or estimated, as the platform reports it); **given** no search ran for a parameter (e.g. exact or number parameters in "All" mode), **then** its chip shows "?" as the count.
6. **Given** the popover shows suggestions, **When** the user clicks a suggested value, **Then** that parameter and value are added as an active filter chip, the list narrows, the input is cleared, and the selector returns to "All".
7. **Given** the user types more characters, **When** new suggestions arrive, **Then** results for an older input never replace results for a newer one.

---

### User Story 2 - Search on one chosen parameter (Priority: P1)

The user picks a specific search parameter in the selector (from the dropdown, or by clicking a parameter chip in the popover). The selector shows the chosen parameter with its search type, and the popover only shows suggestions for that parameter. Pressing Enter applies the typed text as the value, even if no suggestion was picked.

**Why this priority**: Needed to search exact text and number parameters, which have no suggestions, and to narrow suggestions when the user knows which attribute they want.

**Independent Test**: Choose an integer parameter in the selector, type a number, press Enter, and confirm a chip for that parameter and value is added and the list narrows; repeat with a prefix parameter and confirm only that parameter's suggestions are shown.

**Acceptance Scenarios**:

1. **Given** the selector is opened, **When** the options are shown, **Then** they contain "All" (default), "All except relations", and every text, integer and decimal search parameter, each with a clear indicator of its search type (prefix, full-text, exact, allowed values, integer, decimal), grouped by relation (the entity's own parameters in one group, then one group per relation).
2. **Given** a prefix or full-text parameter is selected, **When** the user types, **Then** the popover only shows suggestions for that parameter and only searches that parameter.
3. **Given** an allowed-values parameter is selected, **When** the user types, **Then** the popover lists that parameter's allowed values filtered by prefix on the typed text, without waiting on the server.
4. **Given** an exact text, integer or decimal parameter is selected, **When** the user types, **Then** no popover opens.
5. **Given** any parameter other than "All" or "All except relations" is selected and the input holds a value, **When** the user presses Enter, **Then** the typed text is applied as that parameter's value, a chip is added, and the selector returns to "All".
6. **Given** "All except relations" is selected, **When** the user types, **Then** parameters reached through a relation are left out of both the parameter chips and the suggestion groups.
7. **Given** an integer parameter is selected, **When** the user presses Enter with text that is not a whole number, **Then** no filter is applied and the user is told the value is not valid for that parameter.

---

### User Story 3 - See and remove active filters (Priority: P1)

Above the search bar, every active filter is shown as a chip with the parameter, its search mode and the value. Each chip has a close button. Clicking it removes that filter immediately.

**Why this priority**: Without visible, removable filters the user cannot tell why the list is narrowed or undo a search. It is part of the minimal usable slice.

**Independent Test**: Apply two filters, confirm both chips appear with their search mode visible, close one, and confirm the list updates straight away with only the other filter applied.

**Acceptance Scenarios**:

1. **Given** filters are active, **When** the collection page is shown, **Then** the chip row shows one chip per active filter, each with the parameter name, the search mode and the value.
2. **Given** a chip is shown, **When** the user clicks its close button, **Then** the filter is removed and the list updates immediately, without a confirm step.
3. **Given** more chips are active than fit on one line, **When** the chip row is shown, **Then** it wraps to at most two lines and scrolls horizontally beyond that.
4. **Given** no filter is active, **When** the page is shown, **Then** the chip row takes no vertical space.
5. **Given** a filter is set in the advanced filter dialog or through the page link, **When** the page is shown, **Then** that filter appears as a chip too.
6. **Given** a filter is set through a quick filter (date range, boolean, number range, allowed value), **When** the page is shown, **Then** it appears as a chip as well as on its quick-filter button; closing the chip clears the quick filter too.

---

### User Story 4 - Quick filter on dates and audit dates (Priority: P2)

Below the search bar, each date and date-and-time attribute has a quick-filter button. Clicking it opens a popover with a range calendar on the left and presets on the right (last day, last week, last month, last year), with Clear and Apply. The "created at" and "last modified at" audit attributes work the same, each with its own icon.

**Why this priority**: Filtering on recent items is common and cannot be done through the text input. It is valuable on its own but not needed for the core search flow.

**Independent Test**: On an entity with a date attribute, open its quick filter, pick "Last week", apply, and confirm the list narrows to items from the last 7 days and the button shows the active state.

**Acceptance Scenarios**:

1. **Given** the entity has a date or date-and-time attribute, **When** the quick-filter row is shown, **Then** it has a button for that attribute; clicking it opens a popover clearly attached to the button.
2. **Given** the popover is open, **When** the user picks a preset or a start and end date and clicks Apply, **Then** the attribute's range filter is set and the list narrows.
3. **Given** a range is applied, **When** the user opens the popover and clicks Clear, **Then** the attribute's filter is removed entirely.
4. **Given** a date-only attribute, **When** a range is applied, **Then** it has no time component; a date-and-time attribute keeps full date-and-time precision.
5. **Given** the entity has "created at" or "last modified at" audit attributes, **When** the quick-filter row is shown, **Then** each has a date quick filter with a dedicated "created" or "modified" icon.

---

### User Story 5 - Quick filter on booleans (Priority: P2)

Each boolean attribute has a quick-filter button that does not open a popover. Clicking it changes its state. The outline shows the state: green for true, red for false, grey for unset (no filter). The button uses the same icons as boolean values elsewhere in the product.

**Why this priority**: A one-click filter for a common attribute type; independent of the other stories.

**Independent Test**: Click a boolean quick filter three times and confirm the list filters on true, then false, then is unfiltered, with the outline green, red, then grey.

**Acceptance Scenarios**:

1. **Given** a boolean quick filter is unset (grey), **When** the user clicks it, **Then** the filter is set to true, the outline turns green and the list narrows.
2. **Given** it is true (green), **When** the user clicks it, **Then** the filter changes to false and the outline turns red.
3. **Given** it is false (red), **When** the user clicks it, **Then** the filter is removed and the outline turns grey.
4. **Given** the button shows a value, **When** it is rendered, **Then** it uses the same true/false icons that boolean values use elsewhere in the product.

---

### User Story 6 - Quick filter on numbers and allowed values (Priority: P3)

Integer and decimal attributes have a quick filter whose popover holds an exact-value input and, below it, Min and Max inputs side by side, then Clear and Apply. Attributes with a fixed list of allowed values have a quick filter whose popover holds a search field above a list of the allowed values; typing filters the list the same way allowed-value suggestions are filtered in the main search bar.

**Why this priority**: Rounds out the quick filters for the remaining attribute types. Useful, but the main search bar already covers exact number search.

**Independent Test**: Open an integer attribute's quick filter, set Min and Max, apply, and confirm the list narrows to that range; open an allowed-values quick filter, type part of a value, pick it, and confirm the list narrows.

**Acceptance Scenarios**:

1. **Given** an integer or decimal attribute, **When** its quick filter is opened, **Then** the popover shows an exact-value input, Min and Max inputs next to each other below it, and Clear and Apply below those.
2. **Given** the user enters values and clicks Apply, **When** the filter is applied, **Then** only the parameters the user filled in are set, and the list narrows.
3. **Given** an attribute with allowed values, **When** its quick filter is opened, **Then** the popover shows a search field above the list of allowed values; typing narrows the list by prefix, without a server round trip.
4. **Given** the user picks an allowed value, **When** it is applied, **Then** the attribute is filtered on that value.

---

### User Story 7 - Quick-filter active state (Priority: P2)

Whatever way a filter was set (the quick filter itself, the advanced filter dialog, or the page link), the matching quick-filter button shows a blue outline and a small cross that clears it.

**Why this priority**: Keeps the quick-filter row honest about the list's state, which every quick-filter story relies on.

**Independent Test**: Set a date filter through the advanced filter dialog, confirm the date quick filter shows the blue outline and cross, click the cross, and confirm the filter is removed.

**Acceptance Scenarios**:

1. **Given** a filter is active on an attribute that has a quick filter, **When** the quick-filter row is shown, **Then** that button has a blue outline and a cross inside it, regardless of where the filter was set (boolean buttons use the green/red outline instead, see User Story 5).
2. **Given** a quick filter is active, **When** the user clicks its cross, **Then** every filter on that attribute is removed without opening the popover.

---

### User Story 8 - Choose which attributes take part in search (Priority: P3)

A configuration layer sets which attributes take part in the search surface for an entity, and each user can adjust it in their preferences, the same way visible table columns are chosen. Search parameters that go through a relation are always included.

**Why this priority**: Large entities can have many searchable attributes; trimming the list keeps the selector and quick-filter row usable. The feature works without it (everything included by default).

**Independent Test**: Exclude one attribute in the user's preferences and confirm that none of that attribute's search parameters appear in the selector, the popover, or the quick-filter row, while relation-based parameters still appear.

**Acceptance Scenarios**:

1. **Given** no configuration or preference exists for an entity, **When** the search surface is shown, **Then** every searchable attribute is included.
2. **Given** the configuration layer excludes an attribute, **When** the search surface is shown, **Then** none of that attribute's search parameters appear in the selector, the popover, or the quick-filter row.
3. **Given** a user preference includes or excludes an attribute, **When** the search surface is shown, **Then** the user preference takes precedence over the configuration layer.
4. **Given** an attribute is excluded, **When** a filter on it arrives through the page link or advanced filter dialog, **Then** it is still applied and still shown as an active filter chip, so the list state is never hidden.
5. **Given** a relation-based search parameter, **When** the search surface is shown, **Then** it is always included, whatever the configuration or preferences say.
6. **Given** the user wants to change which attributes are included, **When** they look for the setting, **Then** they find it in the existing column/display preferences control, next to the visible-columns choice; the search surface itself has no settings control.

---

### Edge Cases

- The entity has no searchable attributes at all: the main search bar is not shown; the quick-filter row is shown only if at least one quick-filterable attribute exists.
- A suggestion request fails: the popover shows an error state for the affected group, distinct from "no suggestions", with a way to retry; other groups still show their results.
- No suggestions match: the popover shows a clear "no matches" state instead of an empty list.
- The user presses Enter in "All" or "All except relations" mode without picking a suggestion: if a suggestion is highlighted with the keyboard, it is applied; otherwise nothing is applied.
- The user types a number in "All" mode for an entity that has only text parameters: text parameters are shown as usual.
- A decimal value (e.g. "12.5") is typed: decimal parameters are offered; integer parameters are not, since the value is not a whole number.
- The same parameter already has an active chip and a new value is picked: the new value replaces the old one (a search parameter holds one value).
- Very long input: the input does not grow beyond its row; the text scrolls inside it.
- A count is still loading: the chip or group header shows a loading indicator rather than "0" or "?".
- A relative date preset is evaluated at the moment Apply is clicked, in the user's local time zone; ranges include their bounds.
- The quick-filter row holds more buttons than fit: it scrolls horizontally rather than wrapping into extra rows.
- The user lacks permission to see some items: counts and suggestions only ever reflect items the user can see, as reported by the platform.

## Requirements _(mandatory)_

### Functional Requirements

**Layout**

- **FR-001**: The search surface MUST consist of three stacked rows on the entity item collection page: active-filter chips (top), the main search bar (middle), quick filters (bottom).
- **FR-001a**: The entity item collection page MUST NOT show a page title block (heading, entity icon, item count) above the search surface, so the list gets that height; the breadcrumbs still name the entity and the table footer still shows the item count.
- **FR-002**: The search surface MUST only offer search parameters that the entity's search form provides; it MUST NOT invent parameters or operators.

**Active-filter chips**

- **FR-003**: Each active filter MUST be shown as a chip with the parameter name, its search mode and the value; the chip MUST be built from a shared UI primitive so all chips look and behave the same.
- **FR-004**: Each chip MUST have a close button; clicking it MUST remove that filter and update the list immediately.
- **FR-004a**: The chip row MUST list every active filter, whatever set it: the main search bar, a quick filter, the advanced filter dialog or the page link.
- **FR-005**: The chip row MUST take at most two lines and MUST scroll horizontally beyond that.

**Search-parameter selector**

- **FR-006**: The main search bar MUST have two columns: a search-parameter selector and a free-text input.
- **FR-007**: The selector MUST offer "All" (the default), "All except relations", and every text (prefix, full-text, exact, allowed values), integer (exact) and decimal (exact) search parameter of the entity.
- **FR-008**: Each parameter in the selector MUST show a clear indicator of its search type.
- **FR-009**: Parameters MUST be grouped by relation: the entity's own parameters in one group and one group per relation, labelled with the relation name, when the entity has relations.
- **FR-010**: After a filter is applied from the main search bar, the selector MUST return to "All".

**Suggestions popover**

- **FR-011**: In "All" and "All except relations" mode, the popover MUST open once the input holds at least one character.
- **FR-012**: The popover's top row MUST show chips for the search parameters that match the input; clicking one MUST select that parameter in the selector.
- **FR-013**: When the input is not a number, integer and decimal parameter chips MUST be left out; when it is a number, integer and decimal chips MUST come first and text chips after, none left out. Integer chips MUST only be offered for whole numbers.
- **FR-014**: Each parameter chip and each suggestion group header MUST show the expected number of results for that parameter, exact or estimated as reported by the platform, with estimated counts visibly marked as such; when no search ran for the parameter, the chip MUST show "?".
- **FR-015**: The popover content MUST group suggested values under a header per prefix, full-text or allowed-values parameter, with at most 10 values per parameter.
- **FR-016**: Prefix and full-text suggestions MUST come from real searches on the current input; allowed-value suggestions MUST come from the parameter's known list of allowed values, filtered by prefix on the client without a server round trip.
- **FR-017**: When a specific parameter is selected, the popover MUST only show, and only search for, suggestions for that parameter.
- **FR-018**: When the selected parameter has no suggestions (exact text, integer, decimal), the popover MUST NOT open.
- **FR-019**: Clicking a suggested value MUST add that parameter and value as an active filter, clear the input and return the selector to "All".
- **FR-020**: When a specific parameter is selected and the user presses Enter, the typed text MUST be applied as that parameter's value, whether or not a suggestion was picked; a value that is not valid for the parameter's type MUST NOT be applied and the user MUST be told why.
- **FR-021**: In "All except relations" mode, parameters reached through a relation MUST be left out of both the chips and the suggestion groups.
- **FR-022**: The popover MUST show a loading state while results are pending, a distinct "no matches" state, and a distinct error state with retry; a response for an older input MUST NOT replace results for a newer one.
- **FR-023**: The popover MUST be fully usable from the keyboard (move between chips and suggestions, select with Enter, close with Escape).

**Quick filters**

- **FR-024**: The quick-filter row MUST show one button per included date, date-and-time, boolean, integer, decimal and allowed-values attribute, plus the "created at" and "last modified at" audit attributes; each button that opens a popover MUST have its popover visibly attached to it.
- **FR-025**: A quick filter whose attribute has an active filter MUST show a blue outline and a cross that clears all filters on that attribute, regardless of whether the filter was set through the quick filter, the advanced filter dialog or the page link. Boolean quick filters show their state through the green/red/grey outline instead (FR-028).
- **FR-026**: The date and date-and-time quick filter MUST open a popover with a range calendar on the left and presets (last day, last week, last month, last year) on the right, plus Clear and Apply; Clear MUST remove the attribute's filter entirely; the applied range MUST match the attribute's precision (date-only or date-and-time).
- **FR-027**: The "created at" and "last modified at" audit attributes MUST behave as date quick filters, each with a dedicated "created" or "modified" icon; they MUST be recognised from the attribute's audit role in the profile, never by name.
- **FR-028**: The boolean quick filter MUST NOT open a popover; each click MUST cycle unset → true → false → unset, with a grey, green and red outline respectively, using the same true/false icons as boolean values elsewhere in the product.
- **FR-029**: The integer and decimal quick filter MUST open a popover with an exact-value input, Min and Max inputs side by side below it, and Clear and Apply; only the inputs the user filled in are applied.
- **FR-030**: The allowed-values quick filter MUST open a popover with a search field above the list of allowed values; typing MUST narrow the list by prefix on the client, the same way allowed-value suggestions are filtered in the popover.
- **FR-031**: When the quick-filter row has more buttons than fit, it MUST scroll horizontally.
- **FR-031a**: The collection's "Columns" and "Filters" controls MUST sit on the quick-filter row, right-aligned; only the quick filters scroll, the controls stay in place.

**State and configuration**

- **FR-032**: All filters set through the search surface MUST be part of the page's link, so refreshing, sharing or navigating back restores them, as existing filters do today.
- **FR-033**: The search surface and the advanced filter dialog MUST share the same filter state: a filter set in one is reflected in the other.
- **FR-034**: Which attributes take part in the search surface MUST be decided per attribute, not per search parameter: excluding an attribute excludes all its search parameters and its quick filter.
- **FR-035**: Inclusion MUST be resolved in the same order as visible columns: user preference first, then the configuration layer, then the default (every searchable attribute included).
- **FR-035a**: Users MUST be able to change which attributes take part in search from the existing column/display preferences control, next to the visible-columns choice.
- **FR-036**: Search parameters that go through a relation MUST always be included; they MUST NOT be configurable for now.
- **FR-037**: A filter on an excluded attribute that arrives through the page link or the advanced filter dialog MUST still be applied and shown as a chip.
- **FR-038**: Users MUST only ever see suggestions, counts and results for items they are permitted to see.

### Key Entities

- **Search parameter**: One way to filter the collection that the entity's search form offers — an attribute (on the entity itself or reached through a relation) combined with a search type: prefix, full-text, exact, allowed values, integer or decimal, or a range bound. Belongs to exactly one attribute.
- **Search mode**: The selector's state — "All", "All except relations", or one specific search parameter.
- **Active filter**: A search parameter with a value currently applied to the collection; shown as a chip; part of the page link.
- **Parameter chip**: An entry in the popover's top row for one search parameter, with its expected result count or "?".
- **Suggestion group**: The suggested values for one prefix, full-text or allowed-values parameter, with a header showing the parameter and its expected result count; at most 10 values.
- **Result count**: The number of items a parameter would return for the current input, exact or estimated, as reported by the platform.
- **Quick filter**: A button for one attribute in the quick-filter row; its type (date, audit date, boolean, number, allowed values) follows from the attribute's type and role.
- **Search inclusion preference**: Per-entity, per-attribute choice of whether the attribute takes part in the search surface; resolved from user preference, then configuration layer, then default.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can narrow a collection to items matching a known value, without opening the advanced filter dialog, in under 10 seconds.
- **SC-002**: Suggestions and counts appear within 1 second of the user pausing typing for 95% of searches.
- **SC-003**: Allowed-value suggestions and allowed-value quick-filter lists narrow with no perceptible delay while typing.
- **SC-004**: A user can remove any active filter in one click.
- **SC-005**: A user can apply a "last week" date filter, a boolean filter, or a number range from the quick-filter row in under 5 seconds each.
- **SC-006**: Reloading or sharing a page with active filters reproduces the same filters and results 100% of the time.
- **SC-007**: For every active filter, the user can see it on the search surface (as a chip or an active quick-filter button) 100% of the time, whichever way it was set.

## Assumptions

- "Search type" and the list of search parameters come from the entity's search form in the profile; the selector shows only those. An attribute can contribute several search parameters (e.g. prefix and exact).
- "All" mode searches every prefix and full-text parameter in parallel to build suggestions and counts; exact text, integer and decimal parameters are not searched in "All" mode and so show "?".
- Result counts are those the platform returns with a search result (exact or estimated); no separate counting mechanism is introduced.
- When a parameter already has an active filter and a new value is applied for it, the new value replaces the old one.
- Boolean quick filters cycle in a fixed order (unset → true → false → unset).
- Relative date presets are evaluated when Apply is clicked, in the user's local time zone, with inclusive bounds.
- The existing advanced filter dialog stays available and unchanged; it and the search surface share one filter state.
- Search inclusion uses the same layered preference mechanism (user override, backend configuration, default) that already decides visible table columns.
- Colour is never the only indicator of state: the boolean quick filter also shows the true/false icon, and the active quick-filter state also shows the cross.
- Quick filters are offered for the entity's own attributes only; range filters over a relation stay in the advanced filter dialog (decided during planning, see plan.md).
- A range filter on one attribute (both bounds) is one active filter: it shows as a single chip, and removing it clears both bounds (decided during planning, see research.md R5).
