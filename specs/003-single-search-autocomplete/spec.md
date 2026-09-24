# Feature Specification: Advanced Single Search Bar with Autocomplete

**Feature Branch**: `003-single-search-autocomplete`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Single search bar for an entity collection that wires in the autocomplete feature."

## Clarifications

### Session 2026-09-23

- Q: When a related record (e.g. a contact's company) has its own searchable fields, should typing a term that matches one of those related fields also produce a suggestion? → A: Yes for search-term suggestions (relation-traversal attributes are included) — but effective-match suggestions are always restricted to records of the same entity type as the collection currently being searched, even when the match came through a relation-traversal attribute.
- Q: Now that value suggestions can come from every attribute plus related entities, is there a maximum number of search-term suggestions shown at once? → A: Yes — a total cap of 20 across all contributing attributes combined (not per attribute), with that budget divided evenly across the attributes that have matching values, and duplicate values within a single attribute deduplicated before counting against its share.
- Q: When the suggestion request itself fails (e.g. a network or server error), what should the user see — the same "no matches" state, or a distinct error indicator? → A: A distinct error state, separate from "no matches", with a way to retry.
- Q: When more than 5 records match, or more values exist than the 20-suggestion budget allows, what determines which ones are shown? → A: The collection's current/default sort order — no separate relevance ranking is introduced.

### Session 2026-09-24

Follow-up decisions made after the initial implementation, while reviewing the feature in place:

- Q: Should relation-traversal search-term suggestions stay on by default, as the 2026-09-23 session decided? → A: No — reversed. Relation search is now opt-in: a toggle on the search surface, OFF by default, shown only when the entity has at least one relation-traversal searchable attribute. Fanning out extra requests across related entities on every keystroke is a heavier cost than the original always-on decision accounted for; the user now chooses to pay it. **This supersedes the 2026-09-23 Q1 answer above** — FR-003 and User Story 2 reflect the current (opt-in) behavior.
- Q: Should a boolean attribute get its own quick filter on the search surface, alongside the existing sort/date shortcuts? → A: Yes — a single-click quick-select chip per boolean attribute, cycling unset → true → false → unset. See User Story 7.
- Q: Where should the single search bar sit relative to the entity collection table's own "Columns"/"Filters" controls? → A: In the same toolbar row as those controls, growing to fill the available space next to them — not as a separate row above the table.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Quick search from a single input (Priority: P1)

A user viewing a list of records for one entity (e.g. all invoices, all contacts) wants to find a specific record, or a good starting search term, without opening a multi-field filter form. They type into a single search box shown above the list. As they type, they see suggestions — some are search terms they can apply to narrow the list, others are specific matching records they can jump to directly.

**Why this priority**: This is the core value of the feature — a fast, low-friction way to find records that doesn't require the user to know which specific field to filter on. Without this, the feature doesn't exist.

**Independent Test**: Can be fully tested by opening any entity collection that has at least one text-searchable field, typing a value into the search box, and confirming both suggestion types appear and behave correctly when selected.

**Acceptance Scenarios**:

1. **Given** an entity collection with a text-searchable field and no active filters, **When** the user types a search term into the single search bar, **Then** they see a suggestion list containing search-term suggestions and, below those, up to 5 matching records ("effective matches").
2. **Given** the suggestion list is showing, **When** the user selects a search-term suggestion, **Then** the term is applied as an active filter and the record list narrows accordingly.
3. **Given** the suggestion list is showing, **When** the user selects an effective-match record, **Then** they are taken directly to that record's detail page.
4. **Given** a search term is active in the single search bar, **When** the user clears the search box, **Then** the list returns to showing all records (subject to any other active filters).
5. **Given** an entity has no text-searchable field defined, **When** the user opens that entity's collection, **Then** the single search bar is not shown.
6. **Given** more than 5 records match the typed term, **When** the effective-match suggestions are shown, **Then** the 5 shown are whichever would sort first under the collection's current/default sort order, not an arbitrary or relevance-based subset.

---

### User Story 2 - Suggestions across every searchable attribute (Priority: P1)

While typing, the user sees suggestions drawn from every DIRECT attribute that supports prefix or full-text search. They can also turn on a "search across relations" toggle on the search surface to additionally draw suggestions from attributes reachable through a relation (e.g. searching contacts also matches on a contact's company name) — off by default, since it fans out extra requests per keystroke (see the 2026-09-24 clarification) — so once enabled they never need to know in advance which related record holds the value they're looking for. Each suggestion makes clear which attribute (and, for a relation-traversal match, which relation) it came from, and suggestions are grouped under their source attribute rather than interleaved in one flat list.

**Why this priority**: Suggestions spanning every searchable attribute, clearly attributed, are what distinguish this from a plain text filter — they give the user immediate, concrete feedback and let them jump straight to the right record. This is the "autocomplete feature" the request explicitly calls for, so it's part of the P1 slice, not a later enhancement.

**Independent Test**: Can be tested by typing a value that only exists in a secondary (non-primary) searchable attribute and confirming a matching suggestion still appears, labeled with the attribute it matched.

**Acceptance Scenarios**:

1. **Given** the entity has more than one text-searchable attribute, **When** the user types a term that matches values in more than one of them, **Then** suggestions from all matching attributes appear, each labeled with its source attribute.
2. **Given** the user has typed enough characters, **When** matching values or records exist, **Then** the suggestion list appears and updates on every keystroke.
3. **Given** the suggestion list is showing, **When** the user stops typing without entering new characters, **Then** the suggestions do not change or reorder on their own.
4. **Given** no values or records match the typed term, **When** the suggestion list would otherwise appear, **Then** the user sees a clear "no matches" state instead of an empty or broken-looking list.
5. **Given** the user has just started typing, **When** a new request for suggestions is in flight, **Then** a loading indicator is shown rather than a flash of empty content.
6. **Given** the request for suggestions fails (e.g. a network or server error), **When** the failure occurs, **Then** the user sees a distinct error indicator — never the same "no matches" message a genuinely empty result would show — with a way to retry.
7. **Given** the typed term matches values in more attributes than the total suggestion budget can show one-for-one, **When** suggestions are shown, **Then** the total number of search-term suggestions never exceeds 20, that budget is divided evenly across the contributing attributes, and any duplicate value within one attribute is only shown once.
8. **Given** the typed term matches an attribute reachable only through a relation (e.g. a company's name, viewed from the contacts collection) **and** the user has turned on relation search, **When** suggestions are shown, **Then** a search-term suggestion for that related attribute appears, but no effective-match suggestion is offered for the related entity's own record — effective matches remain records of the entity type currently being searched.
9. **Given** relation search is off (the default), **When** the typed term matches an attribute reachable only through a relation, **Then** no suggestion for that related attribute appears at all — only direct-attribute suggestions are shown.
10. **Given** the entity has at least one relation-traversal searchable attribute, **When** the user opens the search surface, **Then** a "search across relations" toggle is available, off by default; **given** the entity has no such attribute, **when** the search surface is opened, **then** the toggle is not shown at all.
11. **Given** suggestions from more than one attribute are shown at once, **When** the suggestion list is displayed, **Then** each attribute's values are grouped together under a clear label for that attribute, rather than interleaved across attributes.

---

### User Story 3 - Search stays part of the shareable view state (Priority: P2)

A user who has searched for something wants to copy the page's link, refresh the page, or navigate back to it later (e.g. via browser back button) and see the same search still applied.

**Why this priority**: This matches how every other filter/sort control in the entity collection already behaves (each is reflected in the URL). Losing the search term on refresh or when sharing a link would feel like a regression compared to existing filtering, but the feature is still usable without it, so it's P2 rather than P1.

**Independent Test**: Can be tested by entering a search term, copying the resulting URL, opening it in a new tab, and confirming the same search term and filtered results are shown.

**Acceptance Scenarios**:

1. **Given** the user has entered a search term, **When** the page URL is captured and reopened, **Then** the search term is pre-filled and the list is filtered accordingly.
2. **Given** the user has entered a search term and then navigates elsewhere and back (browser back/forward), **Then** the previous search term and results are restored.

---

### User Story 4 - Quick filtering on constrained-value fields (Priority: P3)

For a field that only accepts a fixed list of allowed values (e.g. a status field), the user can type into the same search bar to instantly narrow down that list of allowed values, without waiting on a server round trip, and pick one to apply as a filter.

**Why this priority**: This extends the same search-as-you-type experience to fields the core suggestion mechanism (User Story 2) doesn't cover, since a constrained-value field's options are known upfront rather than discovered via prefix/full-text search. It's a valuable but self-contained enhancement, independently testable and shippable after the core search experience.

**Independent Test**: Can be tested by typing a partial value that matches one of a constrained field's allowed values and confirming the matching allowed value appears as a suggestion instantly, with no visible loading state.

**Acceptance Scenarios**:

1. **Given** the entity has a field restricted to a fixed list of allowed values, **When** the user types a term matching one or more of those values, **Then** the matching values appear as suggestions without any loading delay.
2. **Given** such a suggestion is showing, **When** the user selects it, **Then** it is applied as an active filter the same way any other search-term suggestion is applied.

---

### User Story 5 - Quick sort from the search surface (Priority: P3)

From the same search surface, the user can pick a sort order for the list without opening a separate control.

**Why this priority**: A convenient shortcut to a capability that already exists elsewhere in the collection view; it saves the user a trip to another control but isn't required for the core search value. Independently testable and shippable on its own.

**Independent Test**: Can be tested by opening the search surface, choosing a sort option, and confirming the record list re-sorts accordingly — matching what choosing the same option in the collection's existing sort control would do.

**Acceptance Scenarios**:

1. **Given** the search surface is open, **When** the user picks a sort option from it, **Then** the record list is sorted accordingly, and the collection's existing sort indicator reflects the same choice.
2. **Given** a sort option was already applied (from either entry point), **When** the search surface is opened again, **Then** it shows that same sort option as currently selected.

---

### User Story 6 - Quick date filtering from the search surface (Priority: P3)

For any date or date-and-time field on the entity, the user can quickly filter to a relative recent period (e.g. "last day", "last week", "last month") directly from the search surface, or pick an explicit start and end date together as a range, instead of setting the "after" and "before" bounds separately.

**Why this priority**: A meaningful convenience for a common task (finding recent records) that reuses filtering capability the collection already supports; valuable on its own and independently testable, but not required for the core search-and-find flow.

**Independent Test**: Can be tested by opening the search surface for an entity with a date field, choosing a "last week" preset, and confirming the list narrows to records whose date falls within the last 7 days.

**Acceptance Scenarios**:

1. **Given** the entity has a date or date-and-time field, **When** the user opens that field's quick-filter control from the search surface, **Then** they see relative presets (e.g. last day / last week / last month) and an option to pick an explicit date range instead.
2. **Given** the user picks a relative preset, **When** it is applied, **Then** the record list narrows to that field's range accordingly.
3. **Given** the user instead picks an explicit start and end date, **When** both are set, **Then** the record list narrows to that exact range, replacing any previously applied preset for that same field.
4. **Given** the entity has more than one date field, **When** the user sets a quick filter on one of them, **Then** the other date field's quick filter is unaffected.
5. **Given** a date quick filter (preset or explicit range) is currently applied to a field, **When** the user opens that field's quick-filter control and clicks Clear, **Then** the applied filter for that field is removed entirely — not merely the control's own unsaved selection — and the record list returns to its state before that filter was applied.
6. **Given** a date-only field (no time component), **When** the user applies a quick filter to it, **Then** the applied range uses date-only precision, never a full date-and-time value; a date-and-time field's quick filter continues to use full date-and-time precision.
7. **Given** a quick-filter control (sort, date, or boolean — see User Story 7) currently has an active value, **When** the search surface is shown, **Then** that control is visually distinguished from one with no active value, even while its own detail panel is collapsed.

---

### User Story 7 - Quick boolean filtering from the search surface (Priority: P3)

For any boolean attribute on the entity, the user can filter to true, false, or clear that filter, directly from the search surface, with a single click each time, without opening the multi-field filter dialog.

**Why this priority**: A lightweight convenience for a common attribute type, mirroring the sort and date-filter shortcuts (User Stories 5 and 6); valuable on its own and independently testable, but not required for the core search-and-find flow.

**Independent Test**: Can be tested by opening the search surface for an entity with a boolean field, clicking that field's quick-select control once (applies true), again (applies false), and a third time (clears the filter), confirming the record list updates accordingly at each step.

**Acceptance Scenarios**:

1. **Given** the entity has a boolean attribute, **When** the user opens the search surface, **Then** they see a quick-select control for that attribute reflecting its current state (unset by default).
2. **Given** the quick-select control shows "unset", **When** the user clicks it, **Then** the attribute's filter is set to true and the record list narrows accordingly.
3. **Given** the quick-select control shows "true", **When** the user clicks it again, **Then** the attribute's filter changes to false and the record list updates accordingly.
4. **Given** the quick-select control shows "false", **When** the user clicks it a third time, **Then** the attribute's filter is cleared entirely and the record list returns to its state before that filter was applied.
5. **Given** the entity has more than one boolean attribute, **When** the user changes one attribute's quick-select value, **Then** the other boolean attribute's filter is unaffected.

---

### Edge Cases

- What happens when the user types a term but never selects a suggestion and never presses enter — does the record list narrow live, or only once the term is explicitly confirmed?
- The search bar's active term must combine with whatever filters are already set via the existing multi-field filter dialog, rather than overriding or hiding them.
- What happens when the user pastes a very long string into the search box?
- What happens when a constrained-value field's allowed values are not fully available up front (e.g. a very large or remotely-loaded list) — does instant client-side filtering degrade gracefully?
- What happens when the user applies a relative date preset and then, separately, edits the same field's bounds via the existing filter dialog — which one wins?
- What happens right at the boundary of a relative date preset (e.g. a record dated exactly 7 days ago for "last week") — is the boundary inclusive?
- What happens when suggestions are still loading and the user types another character before the previous request returns — stale results must not overwrite newer ones.
- What happens when the user turns on relation search mid-session, with a term already typed — do relation-traversal suggestions appear immediately, or only on the next keystroke?
- What happens to an already-applied relation-traversal search-term filter if the user later turns relation search off — does the applied filter stay active even though its source toggle is now off?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST show a single search input above the entity collection list, for any entity whose search configuration includes at least one text-searchable (prefix-match or full-text) field.
- **FR-002**: The system MUST hide the single search input for any entity whose search configuration has no text-searchable field.
- **FR-003**: As the user types, the system MUST draw search-term suggestions from every DIRECT attribute that supports prefix or full-text search — not only one designated attribute. Attributes reachable via a relation traversal (e.g. a related company's name) MUST also contribute suggestions, but only once the user has explicitly turned on relation search for the session (see FR-029); relation-traversal suggestions MUST NOT be included by default.
- **FR-004**: Each suggestion MUST indicate which attribute it was matched against, including the related entity/relation name when the match came through a relation traversal.
- **FR-005**: The system MUST show suggestions only after the user has typed a minimum number of characters, matching the existing suggestion-triggering behavior already used elsewhere in the product.
- **FR-006**: The suggestion list MUST distinguish two kinds of entries: a search-term suggestion (a value to apply as a filter) and an effective-match suggestion (a specific matching record).
- **FR-007**: The system MUST show effective-match suggestions below search-term suggestions in the list, capped at a maximum of 5 records; when more than 5 records match, the 5 shown MUST be whichever would sort first under the collection's current/default sort order (see FR-028).
- **FR-008**: Any record matching the typed term MAY be offered as an effective-match suggestion — there is no additional "uniqueness" or "exact match" requirement beyond matching the term.
- **FR-009**: The suggestion list MUST update on every keystroke that changes the typed term, and MUST NOT change or reorder on its own when the term is unchanged.
- **FR-010**: Selecting a search-term suggestion MUST apply it as an active filter and narrow the record list accordingly.
- **FR-011**: Selecting an effective-match suggestion MUST navigate the user directly to that record's detail page.
- **FR-012**: The system MUST let the user apply a typed term directly (without selecting a suggestion) to narrow the record list.
- **FR-013**: The system MUST let the user clear the search term, returning the record list to its unfiltered (or otherwise-filtered) state.
- **FR-014**: The system MUST visually indicate when suggestions are being loaded, and MUST NOT apply a stale, slower response over a newer one when the user has kept typing.
- **FR-015**: The system MUST visually indicate when no suggestions match the typed term.
- **FR-016**: The system MUST reflect the active search term in a way that survives a page refresh and can be shared via the page's link, consistent with how existing filters and sort behave.
- **FR-017**: The system MUST continue to respect existing access restrictions — a user only ever sees suggestions and results for records they are already permitted to view.
- **FR-018**: The single search bar MUST coexist alongside the existing multi-field filter dialog, unchanged; the search bar's term combines with, rather than replaces, any filters already set through that dialog.
- **FR-019**: For a field restricted to a fixed list of allowed values, the system MUST let the user type to instantly narrow that field's list of allowed values, filtered on the client without a server round trip, and apply a selected value the same way as any other search-term suggestion.
- **FR-020**: The search surface MUST offer a sort control that lets the user choose from the entity's existing sortable options; applying a choice here MUST update the same underlying sort the collection's existing sort control shows and uses.
- **FR-021**: For every date or date-and-time field on the entity, the search surface MUST offer relative-date presets (e.g. last day / last week / last month) that set that field's filter range.
- **FR-022**: The search surface MUST also let the user pick an explicit start and end date together as an alternative to a relative preset, for the same date field.
- **FR-023**: Setting a date quick filter (preset or explicit range) on one date field MUST NOT affect any other date field's filter.
- **FR-024**: An effective-match suggestion MUST always be a record of the same entity type as the collection currently being searched — even when the match was found through a relation-traversal attribute, the system MUST NOT offer the related entity's own record as an effective-match suggestion.
- **FR-025**: The system MUST cap the total number of search-term suggestions shown at once at 20 across all contributing attributes combined, dividing that budget evenly across the attributes (direct or relation-traversal) that have matching values; an attribute with fewer matches than its even share MUST let its unused share be redistributed to attributes with more matches, without exceeding the total cap of 20.
- **FR-026**: Within a single attribute, duplicate matching values MUST be deduplicated before being counted against that attribute's share of the suggestion budget.
- **FR-027**: When the suggestion request itself fails (e.g. a network or server error), the system MUST show a distinct error indicator, never the same "no matches" message a genuinely empty result would show, and MUST let the user retry.
- **FR-028**: When more effective-match records or search-term suggestion values exist than their respective caps (FR-007, FR-025) allow, the system MUST determine which ones to show using the collection's current/default sort order — no separate relevance-ranking mechanism is introduced.
- **FR-029**: The search surface MUST offer a "search across relations" toggle that controls whether relation-traversal attributes contribute search-term suggestions (FR-003); the toggle MUST default to off, and MUST be shown only when the entity has at least one relation-traversal searchable attribute.
- **FR-030**: Search-term suggestions MUST be grouped by their source attribute, with each group clearly labeled (including the relation name, for a relation-traversal group per FR-004) — not interleaved across attributes in one flat, unlabeled list.
- **FR-031**: The date quick-filter control MUST let the user clear a previously applied date range for that field — removing the applied filter entirely, returning that field to its unfiltered state — not merely resetting the control's own unsaved selection.
- **FR-032**: A date quick filter (preset or explicit range, FR-021/FR-022) MUST be applied using the same precision as the underlying field: a date-only field's applied range MUST carry no time component; a date-and-time field's applied range MUST retain full date-and-time precision.
- **FR-033**: The search surface MUST visually distinguish a quick-filter control (sort, date, or boolean) that currently has an active value from one that doesn't, even while that control's own detail panel is collapsed.
- **FR-034**: For every boolean attribute on the entity, the search surface MUST offer a quick-select control reflecting that attribute's current filter state (unset, true, or false).
- **FR-035**: Clicking a boolean quick-select control MUST cycle its value in order unset → true → false → unset; each click MUST apply the new value as the attribute's active exact-match filter, or, when the new value is unset, remove that filter entirely.
- **FR-036**: The single search bar MUST be positioned within the entity collection table's own toolbar row, alongside its "Columns"/"Filters" controls, growing to fill the available space next to them — not as a separate row disconnected from those controls.

### Key Entities _(include if feature involves data)_

- **Entity Collection**: The list of records for one entity type currently being viewed; the single search bar narrows this list.
- **Search Term**: The text currently entered into the single search bar; drives suggestions and, once applied, the narrowed record list.
- **Search-Term Suggestion**: A candidate value, attributed to a specific searchable attribute — directly on the entity, or (only when relation search is turned on) reached via a relation traversal — offered to the user while they type, grouped by attribute; applying it filters the collection. Capped at 20 total across all contributing attributes, divided evenly (with unused share redistributed), and deduplicated within each attribute.
- **Effective-Match Suggestion**: A specific record of the same entity type as the collection being searched, matching the typed term (regardless of whether the match came from a direct or relation-traversal attribute), offered directly (up to 5 at a time, chosen by the collection's current/default sort order when more than 5 match); selecting it navigates to that record.
- **Allowed-Value Suggestion**: A candidate value drawn from a constrained field's already-known list of allowed values, filtered instantly on the client as the user types.
- **Sort Shortcut**: A choice, made from the search surface, of one of the entity's existing sortable options and direction.
- **Date Range Shortcut**: A relative preset or explicit start/end pair applied to one date/date-and-time field's filter range, at that field's own precision (date-only or date-and-time); can be cleared back to no filter for that field.
- **Relation Search Toggle**: A user-controlled on/off switch on the search surface, off by default, that determines whether relation-traversal attributes contribute search-term suggestions (FR-003, FR-029); shown only when the entity has at least one such attribute.
- **Boolean Shortcut**: A three-state (unset/true/false) quick filter for one boolean attribute on the entity, cycled by repeated clicks on its quick-select control from the search surface (FR-034/FR-035).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can narrow a record list to a specific record, or navigate directly to it, using only the single search bar, without opening any other filter control, in under 10 seconds for a collection of any size.
- **SC-002**: Suggestions appear within 500ms of the user pausing typing, for at least 95% of searches.
- **SC-003**: At least 80% of users who start typing in the search bar either reach the record they're looking for or successfully narrow the list within 3 keystrokes worth of typing, for collections where the target record's value is known.
- **SC-004**: Reloading or sharing a page with an active search term reproduces the same filtered results 100% of the time.
- **SC-005**: A user can apply a relative date filter (e.g. "last week") to a date field entirely from the search surface, without opening the multi-field filter dialog, in under 5 seconds.
- **SC-006**: Typing into a constrained-value field's quick filter shows matching allowed values with no perceptible delay, since no server round trip is required.
- **SC-007**: A user can apply or clear a boolean quick filter entirely from the search surface, without opening the multi-field filter dialog, in under 5 seconds.

## Assumptions

- The "autocomplete feature" referenced in the request is the product's existing suggest-as-you-type mechanism already used for text-searchable fields; this feature extends that same mechanism to cover every searchable attribute at once, plus record-level ("effective match") suggestions, rather than introducing an unrelated new mechanism.
- The single search bar is an additional, low-friction entry point; per the resolved scope, it does not remove or change the existing multi-field filter dialog, which continues to cover advanced/exact-match/range filtering as it does today.
- "Text-searchable field" means a field whose search configuration supports prefix or free-text matching — the same class of field the existing autocomplete mechanism already supports.
- A typed term left unconfirmed (no suggestion selected, no explicit submit) is treated the same way an unconfirmed value in an existing autocomplete filter field is treated today: it can still be applied directly as a search-term filter, without requiring the user to pick from the suggestion list.
- Instant, client-side filtering of a constrained field's allowed values only applies when that field's full list of allowed values is already available to the client (inline options); a field whose allowed values are loaded remotely/paginated falls outside this instant-filtering behavior.
- Relative date presets ("last day/week/month") are evaluated against the current date/time at the moment they're applied, using the user's local time.
- The sort and date-filter shortcuts surfaced here reuse the collection's existing sort and date-filter capabilities; they don't introduce any sort order or filter operator that isn't already available today.
- The boolean quick-select shortcut applies its value as the same exact-match filter the multi-field filter dialog would apply for that attribute; it doesn't introduce a new filter operator.
- Relation search stays off across the session by default; turning it on is a per-view choice, not a persisted user preference — trading a slower first-enable step for avoiding the extra per-relation request cost on every keystroke for users who never need it.
- A boolean quick-select's cycle order is fixed at unset → true → false → unset; there is no way to jump directly from unset to false without passing through true.
- No new data is introduced; this feature is a new, faster way to query and act on data that's already retrievable today through the existing multi-field filter dialog and record detail pages.
