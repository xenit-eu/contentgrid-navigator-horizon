# Feature Specification: Generic HAL-Forms Field Renderer

**Feature Branch**: `001-hal-form-layout`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Build a generic HAL-Forms field renderer that works with any HAL-FORMS template, covering both the create-form and search-form paths. Every field must support validation (client and server-sourced), external automation fill, a provenance tag, and standard onBlur/onTouch/onChange hooks. Add a new autocomplete field kind. Fields are arranged via a layout schema that groups them into one- or two-field rows; a field left out of the schema is hidden entirely. The layout schema will later be editable by administrators. Search forms should automatically pair a property's `~before`/`~after` range variants onto the same row."

## Clarifications

### Session 2026-09-18

- Q: Does this feature include migrating the existing create-form and search-form implementations onto the new renderer, or just building the renderer itself? → A: Build the generic renderer only as a new, standalone capability; migrating create/search onto it is separate, later work. The renderer must still support every capability either existing form mechanism currently has, so that later migration isn't blocked by a missing capability.
- Q: What is the fixed set of provenance states the tag must represent? → A: There is no fixed set — provenance must be an extensible mechanism that can render arbitrary caller-supplied content, not a closed list of built-in states. Each field's provenance indicator is also clickable and opens a popover, whose content follows the same extensible-rendering mechanism.
- Q: Does automatic `~before`/`~after` pairing apply only when no explicit layout schema exists, or can it override/participate alongside one? → A: Only applies when no explicit layout schema exists. It is not a separate rule bolted onto rendering — it is itself a way of producing an ordinary layout schema (a dedicated generator for the search-form default), so every normal layout-schema rule (row-size cap, ordering, omission, duplicate handling) applies to it unchanged.

### Session 2026-09-18 (continued, during implementation)

- Q: The autocomplete field kind was built with data fetching wired inside the generic renderer itself — is that the right place for it? → A: No. The search page (whoever has the profile/template context) must own the `useTypeahead` call and hand the live suggestions to the field from outside; the generic renderer must stay as non-fetching for `autocomplete` as it already is for every other field kind. Reverted the internal wiring; `HalFormsField`'s `searchContext` (profile + search-property metadata) stays as a convenience the caller reads, but the caller — not this renderer — calls `useTypeahead`.
- Q: Should this feature stay standalone (FR-022), or should the real search-form UI (`entity-item-collection-view.tsx`) actually migrate onto it now? → A: Migrate the search path now; `FilterSidebar` is no longer needed for that call site and may be deprecated. This supersedes FR-022 for the search path specifically — see the updated FR-022 below. The create-form path (`entity-item-create`) is unaffected and still not migrated.
- Q: Now that the search path has migrated, should the create-form path (`entity-item-create`) migrate onto this renderer too? → A: Yes — migrate `create-entity-item-container.tsx`/`create-entity-item-form.tsx` onto this renderer now, retiring `resolveCreateFieldDescriptors`/`FormContainer`/`FieldRenderer`/`useEntityItemCreateFormState` for that call site (not deleting them — same deprecate-in-place precedent as `FilterSidebar`). This fully supersedes FR-022 for both form paths; FR-023's parity requirement is now satisfied by construction rather than merely targeted.
- Q: Should a layout schema's grouping unit gain a title, a description, and independent collapse/expand behavior — e.g. to label "all the search properties of a related profile" as one named section? → A: Yes. Renamed the grouping unit from `FieldGroup` to `FieldSection` (title was already present but never rendered; this is the first time it becomes visible) and added an optional `description` and an optional `isCollapsible` flag. `title` stays optional — an untitled, non-collapsible section renders exactly as a bare group always has. See the new FR-025 through FR-027 below.
- Q: Now that a section can be titled and collapsible, should the search form's generated default layout actually use one for "all the search properties of a related profile"? → A: Yes — every relation-traversal search property (e.g. `customer.name~prefix`) is placed into its own collapsible section, titled for that relation, one section per relation; every direct (non-relation) property stays in a single, always-visible leading section, unchanged from before. See the new FR-028 below.
- Q: The relation itself has its own description, and so (via a fallback already in place for relation-traversal fields) did every field under it — now that the relation's section can show a description of its own, should both still show it? → A: No — the relation's description belongs on the section only. Removed the field-level fallback to the relation's description; a relation-traversal field's own `description` is simply absent when its own attribute has none (which is always, for a relation traversal — the attribute lives on the other entity's profile). See the new FR-029 below.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fields arrange into a two-column layout (Priority: P1)

Whoever produces a form's layout schema — a hand-authored default, a search form's generated default, or later an administrator's saved arrangement — controls which fields appear and how they're grouped. A row named in the schema with one field renders that field full width; a row with two fields renders them side by side. Any field that the current schema never mentions does not appear on the form at all.

**Why this priority**: This is the layout capability every other story in this spec renders through. Without it, there is no shared arrangement behavior for create and search forms to have in common.

**Independent Test**: Can be fully tested by supplying a layout schema with one two-field row, one single-field row, and one field deliberately omitted, then confirming the rendered form shows exactly two fields side by side, one field full width, and the omitted field nowhere on the page — independent of validation, provenance, or search-specific behavior.

**Acceptance Scenarios**:

1. **Given** a layout schema with a row naming two fields, **When** the form renders, **Then** those two fields appear side by side in that row, in the order the schema lists them.
2. **Given** a layout schema with a row naming exactly one field, **When** the form renders, **Then** that field spans the full width of its row.
3. **Given** a field that exists on the form's template but is not named in any row of the layout schema, **When** the form renders, **Then** that field does not appear anywhere on the form.
4. **Given** a layout schema, **When** the same field is (incorrectly) named in more than one row, **Then** the field renders once, in its first-listed row, and every later duplicate reference is ignored.

---

### User Story 2 - Consistent validation across every form (Priority: P1)

A user filling in any field — on a create form or a search form — sees a validation error next to that field whether the error was caught immediately by a live check (e.g. a required field left blank) or only surfaced after submitting, from the server's response (e.g. a value that turned out to violate a uniqueness rule).

**Why this priority**: Validation is the single most common thing a user actually experiences while filling in a form. Today's two separate mechanisms handling it differently is exactly the inconsistency this feature exists to remove.

**Independent Test**: Can be fully tested by triggering a live validation failure on one field (e.g. clearing a required field) and, separately, submitting a form and having the server reject one value, then confirming both cases show an error message anchored to the correct field, without needing any of the layout, provenance, or autocomplete behavior to be exercised.

**Acceptance Scenarios**:

1. **Given** a required field is left empty, **When** the user leaves that field (or attempts to submit), **Then** a validation error appears next to that field without waiting for a server round trip.
2. **Given** a submitted value that the server rejects as invalid, **When** the server's response comes back, **Then** the affected field shows that error, anchored to the correct field even though the check only ran on the server.
3. **Given** a field currently showing a validation error, **When** the user changes that field's value to a valid one, **Then** the error clears.

---

### User Story 3 - External fill and provenance (Priority: P2)

While a form is open — including right when it loads — an external automation can set a field's value on the user's behalf. Every field, regardless of who or what last set its value, can show an indicator of where that value came from. This indicator is not limited to a small fixed set of built-in states — it can render whatever provenance content a caller supplies for that field. Clicking the indicator opens a popover with more detail, using the same flexible-rendering mechanism.

**Why this priority**: This unlocks automation-assisted data entry and keeps it trustworthy — a user who can't tell an automated fill from their own input is more likely to submit the wrong thing.

**Independent Test**: Can be fully tested by opening a form, having an external caller set one field's value programmatically, and confirming the field updates with a provenance indicator shown that can be clicked to reveal more detail in a popover — independent of whether the user has touched any other field or submitted anything.

**Acceptance Scenarios**:

1. **Given** a form is open, **When** an external automation sets a field's value, **Then** that field updates to show the new value and a provenance indicator, without the user needing to refresh or reopen the form.
2. **Given** a user is actively editing a field, **When** an external automation attempts to set that same field's value at the same time, **Then** the user's in-progress edit is preserved and the automation's value does not silently overwrite it.
3. **Given** a field's provenance indicator is showing, **When** the user clicks it, **Then** a popover opens showing that field's provenance content in more detail.
4. **Given** a field with no provenance content to show, **When** the form renders, **Then** no provenance indicator appears for that field (nothing is shown or clickable).

---

### User Story 4 - Search forms pair range fields automatically (Priority: P3)

When no explicit layout schema has been given for a search form, its default arrangement is itself generated as an ordinary layout schema — produced by a dedicated generation step for search forms specifically. That generated schema places a searchable property's "from" (`~after`) and "to" (`~before`) variants — for example, a date range — together in the same row, wherever both are present, without anyone having to place them there by hand.

**Why this priority**: This is a convenience specific to search forms, valuable but narrower in impact than the layout, validation, and provenance capabilities every form depends on.

**Independent Test**: Can be fully tested by rendering a search form (with no explicit layout schema supplied) for a property that exposes both range variants, and confirming they appear together in one row of the generated schema, independent of every other story in this spec.

**Acceptance Scenarios**:

1. **Given** a searchable property with both a `~before` and an `~after` variant, **When** the search form renders without an explicit layout schema, **Then** its generated default layout schema places both variants together in the same two-field row.
2. **Given** a searchable property with only one of the two range variants available, **When** the search form's default layout schema is generated, **Then** that single variant occupies its own full-width row rather than waiting for a partner that doesn't exist.
3. **Given** an explicit layout schema has been supplied for a search form, **When** that form renders, **Then** the generated default (and its automatic pairing) is not used — the explicit schema is followed exactly as any other layout schema would be.

---

### User Story 5 - Autocomplete field kind (Priority: P3)

A field whose values should be looked up from a searchable source, rather than typed freely or chosen from a short fixed list, offers the same suggest-as-you-type behavior already familiar from the existing search filter bar.

**Why this priority**: This extends the renderer's field-kind coverage; valuable, but only for the subset of fields that need lookup-style input, and it builds on top of the layout and validation behavior the higher-priority stories already establish.

**Independent Test**: Can be fully tested by rendering a single autocomplete field on its own, typing a partial value, and confirming matching suggestions appear and one can be selected — independent of every other field kind or story in this spec.

**Acceptance Scenarios**:

1. **Given** an autocomplete field, **When** the user types a partial value, **Then** matching suggestions appear for selection, consistent with the existing search filter bar's autocomplete behavior.
2. **Given** an autocomplete field with a value already set (by the user or by external fill), **When** the form renders, **Then** that value displays as the field's current selection.

---

### Edge Cases

- What happens when a layout schema names the same field in two different rows? Only the field's first-listed occurrence renders; later duplicates are ignored (see User Story 1, Scenario 4).
- What happens when a layout schema references a field that no longer exists on the form's template (removed or renamed)? That reference is dropped; every other row in the schema continues to render normally.
- What happens when both a live client-side check and a server-returned validation error exist for the same field at the same time? The server-returned error is authoritative and is what the user sees, since it reflects the most recent, most complete check.
- What happens when an external automation tries to fill a field the user is actively editing? The user's in-progress edit wins; the automation's value is not applied to that field while it's being edited (see User Story 3, Scenario 2).
- What happens when a field has no provenance content to show? Its provenance indicator does not render at all — there is no empty or placeholder indicator to click (see User Story 3, Scenario 4).
- What happens when a search property has only a `~before` or only an `~after` variant, not both? It renders alone in its own full-width row (see User Story 4, Scenario 2).
- What happens when an explicit layout schema is supplied for a search form? The generated default (including its automatic pairing) is skipped entirely — the explicit schema is the only one used (see User Story 4, Scenario 3).
- What happens when an autocomplete field's suggestion source is temporarily slow or unavailable? The field shows the same loading/unavailable treatment already used elsewhere in this product for a remote-sourced field, rather than failing the whole form.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render a form's fields from its HAL-FORMS template without any per-entity or per-form-type hardcoding of field names or arrangement.
- **FR-002**: System MUST apply the same field-rendering behavior (kinds, validation display, provenance, standard interaction hooks) to both create forms and search forms.
- **FR-003**: System MUST arrange a form's fields into rows described by a layout schema, where each row holds exactly one field (rendered full width) or exactly two fields (rendered side by side).
- **FR-004**: System MUST NOT render a field that is not named anywhere in the current layout schema.
- **FR-005**: System MUST preserve the order of rows and, within a row, the order of its one or two fields, exactly as the layout schema lists them.
- **FR-006**: System MUST render only a field's first-listed occurrence when a layout schema names the same field in more than one row, ignoring later duplicates.
- **FR-007**: System MUST drop a layout schema's reference to a field that is absent from the form's current template, without failing to render the rest of the form.
- **FR-008**: System MUST show a validation error next to its field as soon as a live, client-side check determines the current value is invalid, without waiting for a server round trip.
- **FR-009**: System MUST show a validation error next to its field when the server's response, after submission, reports that field's value as invalid — even though no client-side check caught it beforehand.
- **FR-010**: System MUST clear a field's validation error once the user supplies a value that passes the check that produced it.
- **FR-011**: System MUST allow a field's value to be set programmatically by an external caller while the form is open, including at initial render, and reflect that value immediately.
- **FR-012**: System MUST preserve a user's in-progress edit to a field over a concurrent external attempt to set that same field's value.
- **FR-013**: System MUST provide every field with a provenance indicator whose content is not limited to a fixed, built-in set of states — the mechanism MUST be able to render arbitrary provenance content supplied by the caller for that specific field.
- **FR-014**: System MUST make a field's provenance indicator clickable, opening a popover; the popover's content MUST follow the same caller-supplied, arbitrary-rendering mechanism as the indicator itself.
- **FR-015**: System MUST NOT render a provenance indicator for a field that has no provenance content supplied.
- **FR-016**: System MUST provide every field with standard interaction hooks fired on the field losing focus, on the field's first interaction, and on the field's value changing.
- **FR-017**: System MUST support an autocomplete field kind that suggests matching values from a searchable source as the user types, consistent with this product's existing search-filter autocomplete behavior.
- **FR-018**: When no explicit layout schema is supplied for a search form, System MUST generate one as that form's default, via a dedicated generation step for search forms, rather than falling back to the plain one-field-per-row default used elsewhere.
- **FR-019**: The layout schema generated by FR-018 MUST place a search property's `~before` and `~after` range variants together in the same row whenever both are present, and MUST render a range variant in its own full-width row when only one of the pair is present.
- **FR-020**: The layout schema generated by FR-018 is an ordinary layout schema, not a special-cased rendering rule — every other layout requirement in this specification (row-size cap, ordering, omission of fields not named, duplicate-reference handling) MUST apply to it exactly as it would to a hand-authored or, later, an administrator-edited schema.
- **FR-021**: System MUST use an explicit layout schema, when one is supplied for a search form, instead of generating the FR-018 default — the automatic range-variant pairing MUST NOT override or participate alongside an explicit schema.
- **FR-022**: ~~This feature MUST deliver the generic renderer as a new, standalone capability. Migrating the existing create-form and search-form implementations onto it is separate, later work and is out of scope here.~~ **Superseded (2026-09-18, see Clarifications)**: both the search-form path (`entity-item-collection-view.tsx`'s filter dialog) and the create-form path (`create-entity-item-container.tsx`/`create-entity-item-form.tsx`) MUST be migrated onto this renderer, in place of the earlier `FilterSidebar`-based and `FormContainer`/`FieldRenderer`-based mechanisms respectively.
- **FR-023**: The generic renderer MUST support every field-level and layout capability that either the existing create-form or the (now-migrated) search-form mechanism provided. Satisfied by construction now that both mechanisms render through this feature.
- **FR-024**: For a search-form `autocomplete` field, the suggestion data (matches, loading state, query callback) MUST be supplied to the renderer from outside — by whichever caller holds the profile/template context needed to fetch them — never fetched by the renderer itself. This is the same non-fetching rule every other field kind in this renderer already follows.
- **FR-025**: A layout schema's grouping unit (a "section") MUST support an optional title and an optional description, rendered above that section's rows when present. A section with neither MUST render no header at all, identical to today's bare grouping.
- **FR-026**: A section's description MUST have no rendering effect on its own — it is only ever shown alongside a title, never in place of one.
- **FR-027**: A layout schema's grouping unit MUST support an optional collapsible flag. When set, the section's rows MUST collapse and expand together as a single unit (never per-row), toggled via the section's own header (title/description, if present) — a collapsible section with neither still exposes a toggle control, just with no label on it. The section MUST start expanded. When unset, the section's rows MUST always render, with no collapse behavior at all.
- **FR-028**: The search form's generated default layout (FR-018) MUST place every search property that traverses a relation into its own collapsible section titled for that relation — one section per distinct relation — instead of the flat, single-section layout used before sections existed. Every direct (non-relation) property MUST remain in a single, always-visible, untitled leading section, unaffected by this grouping.
- **FR-029**: A relation section produced by FR-028 MUST use that relation's own description as the section's description. A field inside that section MUST NOT also carry the relation's description as its own — a relation-traversal field's description comes only from its own attribute, never from the relation it traverses.

### Key Entities _(include if feature involves data)_

- **Form field**: The resolved, renderable representation of one HAL-FORMS template property — its kind (text, number, date, checkbox, file, choice, autocomplete, …), label, required/read-only state, validation constraints, current value, and provenance.
- **Layout schema**: An ordered sequence of sections describing how a form's fields are grouped and ordered. Each section holds an ordered sequence of rows, plus an optional title, an optional description, and an optional collapsible flag (FR-025–FR-027) — e.g. one section per related profile's search properties (FR-028). Each row holds one field (full width) or two fields (side by side). A field absent from every row of every section is not rendered. A layout schema can come from more than one source — a hand-authored default, a search form's dedicated generation step (which is what pairs a property's `~before`/`~after` range variants onto one row, and what places relation-traversal properties into their own titled, collapsible section), or, later, an administrator's saved arrangement — and every source produces the same shape, subject to the same rules.
- **Validation error**: A field-scoped message describing why a value is invalid, sourced from either a live client-side check or a problem response returned by the server after submission.
- **Provenance**: Per-field, caller-supplied content describing where that field's current value came from. Not a fixed set of states — an extensible rendering mechanism, shown as a clickable indicator that opens a popover with the same content in more detail. Absent for a field with nothing to show.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Both the create form and the search form for any entity display validation errors, provenance indicators, and row layout using identical behavior — a fix or improvement made once is observable on both without duplicated, form-type-specific work.
- **SC-002**: Users see a validation error next to the affected field immediately for a live client-side check, and within the same response cycle for a server-returned validation error, 100% of the time.
- **SC-003**: 100% of rendered rows, across every form using this renderer, contain at most two fields, and every visible field was explicitly named in that form's layout schema.
- **SC-004**: 100% of field values set by an external automation while a form is open are visible, with correct provenance, without the user refreshing or reopening the form.
- **SC-005**: 100% of search forms for a property exposing both `~before` and `~after` variants show them together in one row with no manual placement step.
- **SC-006**: A field kind this renderer already supports — including the new autocomplete kind — requires zero additional form-specific code to appear correctly on a newly built create or search form.

## Assumptions

- The layout schema's authoring/editing experience (an administrator-facing layout editor) is a separate, later effort. This feature is responsible for correctly rendering according to a layout schema, however that schema was produced — a hand-authored default, a search form's generated default, or an administrator's saved arrangement later.
- A layout schema that duplicates a field reference across rows, or references a field no longer on the template, is treated as data drift to tolerate gracefully (see Edge Cases), not as an error that should block rendering.
- Provenance and external fill apply per field; once a user has started editing a field in the current session, that field is excluded from being overwritten by a later external fill until the user moves on from it.
- The autocomplete field kind and the standard field interaction hooks reuse the interaction conventions already established by this product's existing search-filter autocomplete, rather than introducing new ones.
- A remote-sourced field (autocomplete, or any field whose choices come from a lookup) follows this product's existing loading/unavailable-state conventions; this feature does not introduce a new one.
- The search form's default-layout generation step (FR-018 through FR-020) is a distinct, self-contained operation an implementation can call in isolation (e.g. "generate the default layout for this search form") — its exact technical shape is a planning-phase decision, not fixed by this specification.
- Provenance content and its popover (FR-013/FR-014) are caller-supplied and format-agnostic at the specification level — this feature defines that the mechanism must exist and be extensible, not the specific visual content any one field populates it with.
- Confirming FR-023's parity requirement (the renderer supports everything either existing mechanism has) is expected to happen through the planning phase's own review against the current create-form and search-form implementations, not by this specification enumerating every existing capability line by line.
