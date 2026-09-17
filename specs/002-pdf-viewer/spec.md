# Feature Specification: PDF Viewer for Content Attributes

**Feature Branch**: `002-pdf-viewer`

**Created**: 2026-09-17

**Status**: Draft — clarified 2026-09-17, awaiting review

**Input**: User description: "PDF viewer for the entity content-focus page: renders content attributes of mimetype application/pdf, with the production toolbar, and rendition-aware preview via the rendition service. Check how the original navigator implemented it. Different file types may be transformed to a PDF by the rendition service; other file types are not part of this story. This only has to handle the mimetype pdf. The annotation part is not part of this story; this just makes sure the PDF viewer is there and the toolbar is present."

**Research**: [`research.md`](research.md) records how the original Navigator and the prototype implement this today, the current state of the rendering stack, and the open questions for the plan. It is input to `/speckit-plan`, not part of the requirements.

## Scope

**In scope**

- Viewing a content attribute whose file is a PDF, on the entity item detail page in the _content-focus_ layout (design mockup page 03).
- The viewer toolbar at production parity: content-attribute selector, page navigation, zoom, search, print, download, fullscreen.
- Viewing a content attribute whose file is **not** a PDF **through the PDF rendition** produced by the platform's rendition service, including the pending, unsupported and failed states of that conversion.
- Every user-visible loading, empty, denied and error state of the above, each with a download fallback where a file exists.

**Out of scope** (tracked elsewhere or deferred)

- The extraction highlight ("annotation") overlay and everything that produces or consumes it: extract service, classify-create, click-to-fill popover, citation navigation (HZN-6B.x and HZN-6A.4). A follow-up story. The research on it was taken out of this spec at review and stays available in the git history of this branch (commit 579bd325).
- User-authored annotations: comments, drawing, stamps, redaction, form filling inside the PDF.
- Native previews of images, video or any non-PDF format that is not converted to PDF (HZN-6A.5, ACC-2906).
- Previewing a locally selected file before it is saved (belongs to the content upload / create story; the viewer receives its document as bytes, so it can be reused there).
- The upload flow itself (replacing a file from the toolbar, upload progress, upload errors): the content-upload story. This spec only requires that the "No file" state hosts the drag-and-drop area (Story 1, scenario 5).
- Byte-range / progressive download of large PDFs (explicitly deferred in the roadmap, Phase 6A).
- Page rotation and thumbnail sidebar (never shipped in production; not requested).
- The attribute-focus layout for entities without a content attribute (mockup page 04) beyond the routing rule that selects between the two layouts.

## Clarifications

### Session 2026-09-17

- Q: How does the viewer authenticate to the rendition service, and where does its endpoint come from? → A: The endpoint is deployment configuration, not a HAL link. Requests carry a token obtained through the platform's token-exchange facility (TokenMonger), which the platform already provides; the user's own API token is never forwarded and unauthenticated calls are not allowed. The response contract (accepted plus job location, poll until ready, explicit "cannot convert" problem) remains an observed-behaviour assumption until ACC-2960 documents it. (Answer from Ranec, relayed 2026-09-17.)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View a PDF stored on an entity item (Priority: P1)

A user opens an entity item that has a content attribute holding a PDF. The page uses the content-focus layout: the document is rendered on the left, the item's attributes and relations in a side panel on the right. The user moves through pages, zooms, downloads the file and switches to fullscreen.

**Why this priority**: This is the core value of the feature and the base every other story builds on. Without it there is no preview at all in the new Navigator.

**Independent Test**: Open a fixture entity item with a multi-page PDF content attribute. The first page renders, the page indicator reads "1 / N", next/previous and zoom work, download delivers the original file, fullscreen toggles. Delivers a usable document preview on its own.

**Acceptance Scenarios**:

1. **Given** an entity item whose content attribute holds a PDF, **When** the detail page opens, **Then** the content-focus layout is shown with page 1 rendered, the indicator "1 / N", and the attribute panel alongside.
2. **Given** page 1 of a 3-page document is shown, **When** the user activates "next page", **Then** page 2 is shown and the indicator reads "2 / 3"; "previous page" is disabled on page 1 and "next page" on page 3.
3. **Given** the document is shown at fit-width (the default), **When** the user zooms in, **Then** the zoom increases to the next preset and the indicator shows the percentage; fit-width and fit-page remain selectable; scrolling continuously through pages keeps the page indicator in sync.
4. **Given** an entity item has two content attributes that both hold a file, **When** the page opens, **Then** the first one in profile order is shown and an attribute selector lets the user switch; switching cancels any load still in flight and never shows the previous document while the new one loads.
5. **Given** an entity item has a content attribute but no file stored in it, **When** the page opens, **Then** the viewer area shows a "No file" state without any error, offers a drag-and-drop area to upload a file for that attribute (the upload behaviour itself is specified in the content-upload story), and the layout stays content-focus.
6. **Given** an entity whose profile has no content attribute, **When** its detail page opens, **Then** the attribute-focus layout is used and no viewer is rendered.
7. **Given** a document is displayed, **When** the user activates Download, **Then** the original file is delivered with its original filename using the user's own credentials.
8. **Given** a document is displayed, **When** the user enters fullscreen and later leaves it, **Then** the viewer fills the screen and afterwards returns to the content-focus layout with the same zoom mode as before.
9. **Given** the document is still loading, **When** the user navigates away, **Then** loading stops and the document's resources are released.

---

### User Story 2 - Preview a non-PDF file through its PDF rendition (Priority: P2)

A user opens an entity item whose content is a Word, Excel, PowerPoint, OpenDocument or other convertible file. The Navigator asks the platform's rendition service for a PDF version and shows it in the same viewer, with clear feedback while the conversion runs and a download fallback when it cannot be converted.

**Why this priority**: A large share of production content is Office documents; without renditions those items show nothing. It reuses the complete viewer from Story 1 and adds one service interaction.

**Independent Test**: With a mocked rendition service, open fixture items holding a .docx, a .xlsx, a .pptx, an unconvertible file and a file whose conversion never completes. The convertible ones display as PDF after a pending state, the unconvertible one shows "Preview not available" with Download, the never-completing one fails visibly within the ceiling with Retry.

**Acceptance Scenarios**:

1. **Given** the content mimetype is not PDF and a rendition service is configured for the deployment, **When** the detail page opens, **Then** the viewer shows a "Preparing preview" state while the conversion is requested and pending, and once ready displays the PDF rendition with every viewer feature (page navigation, zoom, search, print, fullscreen).
2. **Given** a rendition is displayed, **When** the user activates Download, **Then** the original file (not the rendition) is delivered; **When** the user prints, **Then** the rendition as displayed is printed; the UI indicates that a converted preview is shown.
3. **Given** the rendition service reports that the file cannot be converted, **Then** the viewer shows "Preview not available" with Download; this is not presented as an error.
4. **Given** the conversion has not completed within the configured ceiling (default 60 seconds), **Then** the viewer shows "Preview could not be prepared" with Retry and Download, and stops asking the service.
5. **Given** no rendition service is configured, **When** a non-PDF item opens, **Then** "Preview not available" with Download is shown and no conversion request is made.
6. **Given** a conversion is pending, **When** the user switches attribute or leaves the page, **Then** polling stops immediately.
7. **Given** a conversion is pending, **Then** no previously displayed document is visible in the viewer area during the wait.
8. **Given** the content mimetype carries parameters (for example `application/pdf; charset=binary`) or differs in case, **Then** it is still recognised as PDF and shown natively. **Given** the mimetype is missing or a generic binary type, **Then** the item is treated as a conversion candidate when a rendition service is configured, and as "Preview not available" otherwise.

---

### User Story 3 - Find text and print (toolbar parity) (Priority: P3)

A user searches for a word inside the document, steps through the matches, and prints the document, all from the viewer toolbar and fully by keyboard if desired.

**Why this priority**: Completes parity with the production toolbar (search, print). Lower than the stories above because the document is already viewable without them.

**Independent Test**: On a fixture PDF, open search, type a term that occurs seven times, see "1 of 7", step forwards and backwards, toggle match case and whole word, and clear the search. Trigger print and observe the browser print dialog with all pages.

**Acceptance Scenarios**:

1. **Given** a displayed text PDF, **When** the user opens search and enters a term, **Then** the number of matches and the current position are shown ("2 of 7"), the current match is scrolled into view and emphasised, and next/previous (also Enter / Shift+Enter) move between matches.
2. **Given** search is open, **When** the user toggles "match case" or "whole words", **Then** the result set updates accordingly; clearing the term removes all search emphasis.
3. **Given** a displayed document (native or rendition), **When** the user activates Print, **Then** the browser print dialog opens for the document as displayed, all pages.
4. **Given** any toolbar control, **When** the user operates only the keyboard, **Then** the control is reachable, has a visible focus indicator, is labelled for assistive technology, and its effect (page, zoom, match position) is announced.

---

### Edge Cases

- The byte request returns 404: the attribute holds no file; treated as the "No file" state, not as a system failure.
- The byte request returns 401/403/5xx or a problem-details body: an error state with the problem title and a Retry action; Download stays available.
- Corrupt or truncated PDF: "This file cannot be displayed" with Download.
- Password-protected PDF: a "Protected document" state with Download; the viewer never tries to bypass the protection.
- Zero-page or extremely long (hundreds of pages) PDF: no crash; navigation still works; pages render lazily.
- Mimetype with parameters or different casing; missing or generic mimetype (see Story 2, scenario 8).
- Rendition service answers "pending" forever (a known production incident): the ceiling ends the wait visibly.
- Rendition service reports a server error instead of "cannot convert": error state with Retry, not silent fallback.
- Switching item, attribute or leaving the page while a document loads or a conversion is pending: all in-flight work is cancelled and no result from the old source is shown.
- The embedded document renderer throws (third-party rendering failure): the page stays usable; only the viewer area shows an error with Download.
- Viewer height inside the layout: the viewer fills the available height without clipping or a second scrollbar, and re-lays out on resize, fullscreen and panel collapse.

## Requirements _(mandatory)_

### Functional Requirements

**Discovery and gating**

- **FR-001**: The system MUST choose the content-focus layout for an entity item if and only if its entity profile declares at least one content attribute; otherwise it MUST use the attribute-focus layout.
- **FR-002**: The system MUST take the presence of a file, its mimetype, filename and size from the content attribute's metadata on the entity item, and the file's location exclusively from the item's content link for that attribute. A 404 from that link means the attribute holds no file.
- **FR-003**: The system MUST recognise a file as PDF when its mimetype, ignoring parameters and letter case, is `application/pdf`.
- **FR-004**: When more than one content attribute of the item holds a file, the system MUST offer an attribute selector, default to the first attribute in profile order, and cancel any in-flight load when the selection changes.

**Loading and display**

- **FR-005**: The system MUST retrieve document bytes with the current user's credentials through the item's content link. The embedded document renderer (the third-party component that draws pages) MUST never be handed a location it would fetch without those credentials, and retrieved bytes MUST be released when the viewer is closed or its source changes.
- **FR-006**: The system MUST show a loading state while a document or its rendition is being prepared and MUST NOT show a previously displayed document during that time.
- **FR-007**: The system MUST make the first page visible before the remaining pages are rendered and MUST render pages lazily as they come into view.
- **FR-008**: Users MUST be able to move to the previous and next page, see "current / total", and jump to a page by number; scrolling continuously MUST keep the indicator current.
- **FR-009**: Users MUST be able to zoom in and out through presets from 25% to 400%, choose fit-width (default) and fit-page, and see the current level; the chosen zoom mode MUST survive entering and leaving fullscreen.
- **FR-010**: Users MUST be able to select and copy text in text-based PDFs.
- **FR-011**: Users MUST be able to toggle fullscreen; leaving it MUST restore the content-focus layout.
- **FR-012**: Users MUST be able to download the original file with its original filename using their own credentials from every state in which a file exists, including the "Preparing preview" loading state, "Preview not available" and error states.
- **FR-013**: Users MUST be able to print the displayed document (native PDF or rendition), all pages.
- **FR-014**: Users MUST be able to search the document's text, see the match count and current position, step forwards and backwards (including Enter / Shift+Enter), toggle match-case and whole-word, and clear the search; the current match MUST be scrolled into view and emphasised.
- **FR-015**: The viewer MUST fill the available height of the content-focus layout without clipping or nested scrollbars and MUST re-layout on window resize, fullscreen changes and side-panel collapse.

**Rendition-backed preview**

- **FR-016**: When the file is not a PDF and a rendition endpoint is configured for the deployment, the system MUST request a PDF rendition of the stored file and display the result as a PDF with every viewer feature.
- **FR-017**: The system MUST treat rendition preparation as asynchronous: accept a "pending" answer, re-check at a fixed interval (default 2 seconds), and stop with a visible failure and a Retry action once a configurable ceiling (default 60 seconds) is exceeded.
- **FR-018**: The system MUST treat the service's "cannot convert this file" outcome as a normal result shown as "Preview not available" with Download, and any other failure as an error state with Retry and Download.
- **FR-019**: The system MUST request a rendition only when the content attribute holds a file (its metadata says so and its content link does not answer 404) and MUST identify the source file to the service by that link.
- **FR-020**: When a rendition is displayed the system MUST indicate that a converted preview is shown, MUST deliver the original file on Download, and MUST print the rendition as displayed.
- **FR-021**: The system MUST stop polling for a rendition as soon as the viewer is closed, the attribute changes or the item changes.
- **FR-022**: When no rendition endpoint is configured the system MUST show "Preview not available" with Download for non-PDF files and MUST NOT contact any service.
- **FR-023**: The system MUST authenticate every request to the rendition service (the initial request and each poll) with a token obtained through the platform's token-exchange facility (TokenMonger) for that service. It MUST NOT forward the user's own API token and MUST NOT call the service unauthenticated. If no exchanged token can be obtained, the system MUST treat the rendition as unavailable (FR-022 behaviour) rather than fall back to an unauthenticated call.

**States and errors**

- **FR-024**: The system MUST render a distinct, tested state for each of: no file (with the drag-and-drop upload area); bytes could not be retrieved (with the problem title when the platform provides one); file cannot be displayed; protected document; preparing preview; preview not available; preview could not be prepared; viewer failure. Each state MUST offer Download when a file exists, and Retry where a retry can succeed.
- **FR-025**: A failure inside the embedded document renderer MUST be contained to the viewer area; the rest of the detail page MUST remain usable.

**Security**

- **FR-026**: Documents MUST be rendered with embedded scripting disabled, as the original Navigator already does. An automated test with a fixture PDF that contains document JavaScript MUST prove that nothing executes, in line with ADR-011, whichever rendering stack is chosen.
- **FR-027**: All assets the viewer needs at runtime MUST be served from the application's own origin; nothing MUST be loaded from a third-party content delivery network at runtime, and document bytes MUST never leave the user's browser except towards the platform.

**Accessibility**

- **FR-028**: Every toolbar control MUST be reachable and operable by keyboard, have a visible focus indicator, be labelled for assistive technology, and changes of page, zoom and search position MUST be announced.

**Configuration and delivery**

- **FR-029**: The rendition endpoint, the polling interval and the ceiling MUST be deployment configuration; when the endpoint is absent the feature MUST degrade as described in FR-022.
- **FR-030**: The feature MUST be delivered in the experimental track first and promoted through the documented feature-promotion workflow.
- **FR-031**: All user-visible text MUST be translatable.

### Key Entities

- **Content attribute**: An attribute of the entity profile that holds a file. Identifies which attributes can be previewed; there may be several per entity.
- **Content metadata**: What the entity item says about a content attribute's file: whether a file exists, its mimetype, filename and size. Drives the "no file" state and the PDF-versus-rendition decision.
- **Content link**: The item's pointer to the file bytes for one content attribute. It is the only source of the file's location and the identifier passed to the rendition service. When no file is stored, the link answers 404.
- **Preview source**: What the viewer is asked to show: a stored PDF, or a rendition of a stored non-PDF file.
- **Rendition job**: The lifecycle of one conversion request: requested → pending → ready, or unsupported, failed, timed out, cancelled.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For a 20-page PDF of at most 5 MB on a typical office connection, the first page is visible within 3 seconds of the detail page opening (95th percentile over the fixture set).
- **SC-002**: Page navigation and zoom changes take effect within 200 milliseconds for documents up to 200 pages.
- **SC-003**: Every toolbar control can be operated with the keyboard alone, and the automated accessibility suite reports zero violations for the viewer states.
- **SC-004**: Convertible fixture files (.docx, .xlsx, .pptx) display as PDF; the unconvertible fixture shows its fallback within one polling interval; the never-completing fixture fails visibly within the ceiling plus one interval; polling stops on leaving the page in 100% of test runs.
- **SC-005**: A fixture PDF with embedded JavaScript renders in the automated suite with zero observed script side effects.
- **SC-006**: Every state listed in FR-024 exists as a visual-regression snapshot and offers Download whenever a file exists.
- **SC-007**: A sign-off run against at least one real application confirms parity with the production Navigator for: view, page navigation, zoom, search, print, download, fullscreen, and rendition-backed preview.
- **SC-008**: New code for the feature meets the repository quality gate of 80% coverage.

## Assumptions

- **Rendition protocol as observed.** The rendition service answers a request with "accepted" plus a job location, the job answers "pending" until the PDF is ready, and an explicit "cannot convert" problem exists. This is reverse-engineered from the original Navigator and is not yet documented by the platform (ACC-2960). Authentication and endpoint discovery are settled (see Clarifications); the response contract is the remaining assumption.
- **Download always delivers the original file**, never a rendition.
- **Byte-range streaming is out of scope**; the whole file is downloaded before rendering, as in production today.
- **Rotation and thumbnails are not required**; neither exists in production nor in the tickets.
- **ADR-011 governs the rendering stack.** This spec is stack-agnostic; the scripting-posture test of FR-026 applies to whichever stack is chosen, and the stack decision is not re-opened here.
- **The design mockup page 03 is the visual source of truth** for the content-focus layout and toolbar order (attribute selector, page navigation, zoom, then download and fullscreen at the right). Search and print are added on top of it because production has them and HZN-6A.1 requires them.
- **The attribute-focus layout** (page 04) is delivered by the entity-detail feature; this spec only requires the routing rule (FR-001).
- **Existing platform capabilities are reused**: content presence, mimetype and filename come from the item's content metadata; the file location from the item's content link; a credentialed download capability already exists.
- **The annotation overlay is a follow-up story.** Nothing in this story may make it impossible: the viewer receives its document as bytes, exposes page navigation, and is delivered as a reusable component the follow-up can extend. Its requirements and open questions are not part of this spec; the research behind them is in this branch's git history (commit 579bd325).

### Dependencies and references

- **Platform touchpoints**: the entity profile's content attributes; the entity item's content metadata and its `cg:content` links; RFC 9457 problem details, including `https://contentgrid.cloud/problems/renditions/invalid-conversion`; the rendition service endpoint (deployment configuration); the platform's token exchange (TokenMonger) for the rendition service's token.
- **Decisions**: ADR-011 (PDF stack and fallback triggers), ADR-003 (primitive versus pattern boundary), ADR-006 (three-track delivery), ADR-009 (visual regression), ADR-014 (MSW contract tests).
- **Tickets consolidated by this spec**: ACC-2902 (HZN-6A.1 toolbar), ACC-2903 (HZN-6A.2 rendition-aware preview), ACC-2904 (HZN-6A.3 scripting posture). Follow-up annotation story: ACC-2905, ACC-2907, ACC-2908, ACC-2911, ACC-2912. Related platform work: ACC-2960 (document rendition system), ACC-3074 (rendition service 500 instead of 4xx), ACC-1668 (rendition kept answering "pending").
- **Design**: `contentgrid-navigator-mockup 2.html`, pages 03 and 04.
- **Research**: [`research.md`](research.md).
