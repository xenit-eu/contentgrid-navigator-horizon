# Feature Specification: Extract Metadata into the Create Form

**Feature Branch**: `006-metadata-extraction`

**Status**: Draft

**Input**: On an entity's create form, the user can ask the extract service to read the attached file and fill the form's attributes and relations. Each filled field shows where its value came from. The extract service is driven only by its HAL-FORMS templates, the same way the create form is driven by the profile's `create-form` template.

**Research**: [`research.md`](research.md) records the reference implementation, the existing code this feature builds on, the design decisions and the test list. It is input to `/speckit-plan`, not part of the requirements.

## Scope

**In scope**

- An **Extract metadata** action on the create form, shown only when the extract service is configured and its home resource loads.
- Sending the file attached to the create form, the profile of the entity being created and an optional hint to the extract service, using its `basic-extract` or `advanced-extract` template.
- Filling empty attribute fields from the extracted root entity when the value is confident enough, and marking each filled field as **Extracted**.
- Showing the extracted value, confidence and reason for a field, and letting the user apply that value to the field.
- Linking relation candidates the extraction found unambiguously, and letting the user pick one of the other candidates of a relation.
- Discarding the current extraction.
- An extraction report: everything the extraction found for the item and its related entities.
- A warning when existing items look like the item being created.

**Deferred**

- Searching in the relation dialog with the extracted values of the related entity. The relation dialog has no search today; adding one is a separate change, after which extracted values can be offered on its search fields.
- Highlighting citations on the PDF and moving between them. Highlights are drawn on top of the displayed PDF, and the create form does not display the attached file yet (it shows only its name, size and type). This follows a create-form file preview. The extraction data keeps the citations, so the data layer does not change when it is added.

**Not part of this feature**

- The extract service's `classification` and `autocomplete` templates: the reference implementation does not use them. Classification is the follow-up to the Create Item page (`004-create-item-page`).
- Extraction on the edit form: the reference implementation offers extraction on the create form only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fill the create form from the attached file (Priority: P1)

A user on an entity's create form attaches a file, presses **Extract metadata**, optionally types a hint, and confirms. The empty fields the service is confident about get filled, and each one is marked **Extracted**.

**Why this priority**: This is the feature. Every other story builds on an extraction that has already run.

**Independent Test**: Configure the mock extract service, open a create form, attach a file, run the extraction and check that the empty fields hold the extracted values and show the Extracted tag.

**Acceptance Scenarios**:

1. **Given** the extract service is not configured, or its home resource fails to load, **When** the create form opens, **Then** no **Extract metadata** action is shown.
2. **Given** the create form has no file attached, **When** the form renders, **Then** **Extract metadata** is shown but disabled.
3. **Given** a file is attached, **When** the user runs the extraction, **Then** the request is built from the extract template with the file, the entity profile's URL and the hint. Optional template properties are sent only when the template declares them.
4. **Given** the extraction returns a value for an empty field with confidence above 0.75, or with no confidence, **When** it is applied, **Then** the field holds that value and shows the **Extracted** tag.
5. **Given** a field already has a value, its extracted confidence is 0.75 or lower, or the user is editing it, **When** the extraction is applied, **Then** that field keeps its current value.
6. **Given** the service answers with a problem response, or the request fails, **When** the extraction fails, **Then** the error is shown in the extract dialog and the form is unchanged.

---

### User Story 2 - Review and apply an extracted value (Priority: P2)

For any field the extraction has a value for, the user opens the field's extraction details to see the extracted value, the confidence and the reason. They can apply the value, which overwrites what is in the field.

**Why this priority**: Fields that were skipped in Story 1 (because they had low confidence or already had a value) can then still be filled on purpose.

**Independent Test**: Run an extraction where one field is below the threshold, open that field's details and apply the value.

**Acceptance Scenarios**:

1. **Given** an extraction has a value for a field, **When** the user opens its details, **Then** the extracted value, confidence (when present) and reason (when present) are shown.
2. **Given** the field's current value differs from the extracted value, **When** the user applies it, **Then** the field holds the extracted value and shows the **Extracted** tag.
3. **Given** the user discards the extraction, **When** the form re-renders, **Then** the extraction details and tags disappear and the field values stay as they are.

---

### User Story 3 - Link related items the extraction found (Priority: P3)

When the extraction found related entities and the service searched for matching existing items, unambiguous matches are linked automatically. For the other related entities, the user picks one of the candidates.

**Why this priority**: It saves the most manual work after attributes, but it depends on the service's candidate search and on the to-many option.

**Independent Test**: Run an extraction whose root entity has a to-one relation with a single confident candidate and a to-many relation with entries that each have a single candidate. Check that they are linked, then pick a candidate for a relation that has several.

**Acceptance Scenarios**:

1. **Given** a to-one relation whose extracted entity has exactly one candidate with confidence above 0.75, **When** the extraction is applied, **Then** the relation field links that candidate.
2. **Given** a to-many relation, **When** the extraction is applied, **Then** every extracted entry with exactly one candidate is added to the field, without duplicating items already linked.
3. **Given** a relation with several candidates, **When** the user opens its extraction details and picks one, **Then** the relation field links the chosen item. For a to-many relation it is added to the existing items.
4. **Given** a picked candidate, **When** the user removes it from the extraction details, **Then** it is unlinked from the relation field.

---

### User Story 4 - See everything the extraction found (Priority: P4)

After an extraction, the user opens the extraction report and sees every extracted attribute of the item, with value, confidence and reason, and every related entity the extraction found, with its own attributes.

**Why this priority**: Fields show their own details one at a time; the report is the overview, useful before creating the item.

**Independent Test**: Run an extraction with attributes and relations, open the report and compare it with the extraction fixture.

**Acceptance Scenarios**:

1. **Given** an extraction, **When** the user opens the report, **Then** each extracted attribute of the item is listed with its value, and its confidence and reason when present.
2. **Given** the extraction found related entities, **When** the report is open, **Then** each relation lists the related entities with their extracted attributes.
3. **Given** no extraction has run or it was discarded, **When** the form renders, **Then** there is no report action.

---

### User Story 5 - Warn about items that may already exist (Priority: P5)

When the service's candidate search finds existing items that look like the item being created, the user sees a warning and can open the list of those items before creating a duplicate.

**Why this priority**: It prevents duplicates, but only when the candidate search is used.

**Independent Test**: Run an extraction whose root entity has candidates, open the warning and open one of the listed items.

**Acceptance Scenarios**:

1. **Given** the extracted item has candidates, **When** the extraction is applied, **Then** a warning is shown next to the report action.
2. **Given** the warning, **When** the user opens it, **Then** each candidate is listed with its confidence and the attributes that matched, and can be opened in a new tab.
3. **Given** the extracted item has no candidates, or the candidate search was not run, **When** the extraction is applied, **Then** no warning is shown.

### Edge Cases

- The extract home has only one of `basic-extract` / `advanced-extract`: the action uses the template that exists, and the **Explain reasoning** choice is shown only when both exist.
- The create form has more than one file field with a file in it: the first file value in form order is sent.
- The extraction names an attribute or relation that is not in the create template: it is ignored.
- The root entity's id is missing from `entities`: the extraction is treated as empty and nothing is filled.
- The user switches entity or resets the form (continuous create): the extraction is discarded together with the form state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The extract service URL MUST come from the runtime app config's `extractServiceUrl`. The URL, method and content type of the extraction request MUST come from the extract home's `_templates`. The only URL built by the client is the token-exchange endpoint (FR-010).
- **FR-002**: The action MUST be gated on the extract home loading and on the chosen extract template being present.
- **FR-003**: The request MUST be encoded with the HAL-FORMS codec of the chosen template, with values `file`, `profile_endpoint` (the profile entity's own link href) and `prompt`. `llm_provider`, `search_candidates` and `process_to_many_relations` are sent only when the template declares them.
- **FR-004**: When the template's `llm_provider` property has inline options, the user MUST be able to choose one. The template's value is the default.
- **FR-005**: Extracted attribute values MUST be written through the existing field-state external-write path, so that a field being edited is never overwritten and the field shows the **Extracted** tag.
- **FR-006**: Auto-fill MUST only fill empty fields, and only when the value is non-null and its confidence is above 0.75 or absent.
- **FR-007**: Auto-link MUST follow FR-006's threshold for to-one relations (a single candidate above 0.75). For to-many relations it links each entry with exactly one candidate, merged into the current value without duplicates.
- **FR-008**: Problem responses from the extract service MUST be shown with the existing problem-details display.
- **FR-009**: Extraction state MUST live in the create form container. It is discarded on reset or on discard, and never stored in the URL or in browser storage.
- **FR-010**: Requests to the extract service MUST NOT carry the user's application token. They MUST carry a token exchanged for the extract service at the application's token-exchange endpoint.
- **FR-011**: Extracted values MUST be converted to the type of the field they fill. A value that cannot be converted is not written, and its details are still shown.
- **FR-012**: The report MUST be built only from the current extraction and MUST NOT change the form.
- **FR-013**: The duplicate warning MUST be shown only when the extracted item has at least one candidate. Each candidate is fetched by its `href` as given; the item's id comes from the fetched item, never from the `href`.

### Key Entities

- **Extract home**: the extract service's root HAL resource. It holds the `basic-extract` and `advanced-extract` templates.
- **Extraction**: the service response. It has a `root_entity` id and a flat list of `entities`.
- **Entity extraction**: one extracted entity. It has an `id`, the entity name, attribute extractions, relation extractions (`ref` for to-one, `refs` for to-many), and an optional candidate search.
- **Attribute extraction**: `name`, `value`, and optional `confidence`, `reason` and `citations`.
- **Candidate**: an existing item that may be the extracted entity. It has an `href`, a `confidence` and `matched_attributes`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With the mock extract service, a user fills a create form from a file in one action plus a confirm.
- **SC-002**: No field the user has typed in or is editing is changed by an extraction unless the user applies the value explicitly.
- **SC-003**: Without an extract service configured, the create form looks and behaves exactly as before.
- **SC-004**: Every rule in FR-003, FR-006, FR-007, FR-010 and FR-011 is covered by a test that fails if the rule is broken.

## Assumptions

- The extract service is optional. Environments without one keep today's create form unchanged.
- The extract service's home resource and response shape are the contract (see [`contracts/extract-service.md`](contracts/extract-service.md)).
- The client uses one confidence threshold, 0.75, for auto-fill and for auto-linking to-one relations.
- The file to extract from is the one already held by the create form's file field. Extraction does not upload anything to the application.

### Dependencies and references

- The create form's field state with external writes and the **Extracted** tag (`001-hal-form-layout`).
- The Create Item page's attached file (`004-create-item-page`, not yet on `main`). Without it, the user attaches the file in the create form's own file field.
- The reference extraction flow, summarised in [`research.md`](research.md).
