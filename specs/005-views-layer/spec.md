# Feature Specification: Views Layer Between Apps and Features

**Feature Branch**: `ACC-3216-1-spec` (stacked series ACC-3216, PRs 1–10)

**Created**: 2026-10-06

**Status**: Draft

**Input**: Jira ACC-3216. Add a views layer between the apps and the features. The app reads the URL and passes plain values; a view uses them to load data and lay out the page; features fill the space a view gives them. Views can also be shown by other hosts (the chat assistant, Storybook) and placed next to each other. The design was approved by the reviewer on 2026-10-06; the open questions below are to be settled by the team.

**Research**: [`research.md`](research.md) records the current state of the code and the alternatives considered. It is input to `/speckit-plan`, not part of the requirements.

## Scope

**In scope**

- A new layer of **views** that own page composition: which data a page needs, loading it, the toolbar (breadcrumbs and actions) and where each feature or child view sits.
- A single way to open a view: by entity name and item id, or by a link from the API.
- A view state (filters, sort order, page) that is separate from what the view shows, and that a host can read and write.
- One navigation object provided by the host, so only views navigate, and neither views nor features talk to the router.
- Views that contain other views, with a list and detail split as the first example.
- Stability tags that move from features to views.
- Display preferences that move out of the features into the data layer, with configurable storage.
- Import rules per layer, enforced by lint.

**Out of scope** (tracked elsewhere or deferred)

- Building the chat assistant itself; this spec only requires that views can be shown from an API link and with a host-provided navigation.
- The unsaved-changes guard: where it lives is an open question; it stays as it is in this series.
- The backend preferences API: the merge exists, the backend part keeps returning nothing until the API is defined.
- Saving user preferences on the server.
- New pages. Existing pages move into views without changing what the user sees.
- Reinstating the stability gate in the generic app: it stays suspended until go-live (ADR-006 amendment).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One item detail page for both apps (Priority: P1)

A developer fixes a bug on the item detail page. The fix lands in one place and both the generic and the experimental app get it.

**Why this priority**: Both apps copy the same page code today, so every fix lands twice. This is the first slice that proves the layer and removes real duplication.

**Independent Test**: Open an item in each app against the same fixtures: the page looks and behaves the same as before, and the page logic exists once.

**Acceptance Scenarios**:

1. **Given** an item URL in either app, **When** the page opens, **Then** the app passes only the entity name and item id, and the item detail page shows with its toolbar, content and relations as before.
2. **Given** the app's route starts loading before the page shows, **When** the page renders, **Then** it resolves its data from what was already loaded, with no second wait for the same data.
3. **Given** a relation mutation fails with a relation problem, **When** the page handles it, **Then** the same dialog shows in both apps with the same text.
4. **Given** the entity name is unknown, **When** the page opens, **Then** one consistent not-found state shows instead of a blank page.
5. **Given** the user clicks a breadcrumb or a related item, **Then** the app navigates exactly as before, through the host-provided navigation.

---

### User Story 2 - A collection page that remembers how I left it (Priority: P1)

A user filters and sorts a list, opens an item, and returns through the breadcrumb. The list is as they left it.

**Why this priority**: The collection route holds the most page logic of any route. Moving it behind a view state is the proof that the view/state split works, and the restore behaviour must not regress.

**Independent Test**: Apply a filter, sort and move to page two, open an item, click the list breadcrumb: filters, sort and page are restored. Reload with filters in the address: the filters are applied.

**Acceptance Scenarios**:

1. **Given** the user applies a filter, **When** the filter changes, **Then** the app's address reflects it and the page number resets.
2. **Given** a list address that already carries filters or a sort, **When** the page opens, **Then** the list shows with them applied.
3. **Given** the user opened an item from a filtered list, **When** they return through the list breadcrumb, **Then** filters, sort order and page are restored without the item's address carrying them.
4. **Given** a host that does not store state, **When** the collection view shows, **Then** it keeps its own state while mounted.
5. **Given** the user switches to another entity, **Then** state of the previous entity does not leak into the new list.

---

### User Story 3 - Show an item or list from an API link (Priority: P2)

A host that only has a link from the API (for example the chat assistant) shows the same item page or list that the app shows for a route.

**Why this priority**: It is the second host the design is built for, but it needs the P1 slices first.

**Independent Test**: Open the item view once by name and once by its API link in the same session: both show the same page, and the item is fetched once.

**Acceptance Scenarios**:

1. **Given** a link to an item, **When** a view is opened with it, **Then** the view shows the same page as when opened by entity name and item id.
2. **Given** a link, **When** the view starts, **Then** the entity's profile is found from the link's own response, or from the profiles that describe the resource when the response gives none; the entity name is never cut out of the link text.
3. **Given** the same item opened by name and by link, **Then** it is loaded once and shared.
4. **Given** a link to a search that already contains filters, **Then** the view shows the results; whether the filter form shows those filters is an open question.
5. **Given** a host with its own navigation (for example "open in Navigator"), **When** the user clicks a breadcrumb or related item, **Then** the host's navigation runs and the app's route change does not.

---

### User Story 4 - A list and its detail side by side (Priority: P2)

A user sees a list on the left and the selected item on the right, in one screen. Selecting another item in the list changes the right pane without leaving the screen.

**Why this priority**: It is the reason views must contain views and fill the space they get. It depends on stories 1 and 2.

**Independent Test**: Open the split view, select two items in turn: the detail pane follows, the route does not change, and one toolbar is shown.

**Acceptance Scenarios**:

1. **Given** the split view, **When** the user selects an item in the list, **Then** the detail pane shows that item and the screen does not navigate.
2. **Given** the list and the detail views also work as pages on their own, **Then** the split view is made of those views, not of a copy.
3. **Given** the split view, **Then** one toolbar shows for both panes, and the children do not draw their own.
4. **Given** each pane has its own filters, sort and page, **Then** a change in one pane does not overwrite the other's (the address format is an open question).
5. **Given** the route starts loading, **Then** the data of both panes starts loading in one go.

---

### User Story 5 - Features that fit any space (Priority: P2)

A developer puts a feature in a pane, a dialog or a chat panel. It fills the space it is given, scrolls inside it, and does not draw a toolbar or touch the router.

**Why this priority**: Without it, features cannot be reused in any host except a full page.

**Independent Test**: Render each feature story in a fixed-size box: it fills the box, nothing overflows the box, and the snapshot is stable.

**Acceptance Scenarios**:

1. **Given** a feature in a box of fixed size, **Then** it fills the box and its inner lists scroll.
2. **Given** a feature, **Then** it has no outer padding and no size tied to the browser window.
3. **Given** a view, **When** its host turns the toolbar off, **Then** the view shows without one and still works.
4. **Given** a feature, **Then** it reports user actions through callback props, which its view wires to the navigation object; it never reads the navigation object and never navigates itself.

---

### User Story 6 - Layer boundaries are enforced (Priority: P3)

A contributor imports from the wrong layer. Lint fails with a message that names the rule.

**Why this priority**: The boundaries only hold when something checks them, but they can be added after the first routes work.

**Independent Test**: A fixture file for each forbidden import fails lint; the real code passes.

**Acceptance Scenarios**:

1. **Given** an app importing a feature directly, **Then** lint fails.
2. **Given** a feature importing the router, **Then** lint fails.
3. **Given** the UI package importing a feature, **Then** lint fails.
4. **Given** a stable view importing an experimental view, **Then** lint fails.
5. **Given** the generic app importing an experimental view while the gate is suspended pre-GA, **Then** lint passes, as today.

---

### User Story 7 - Preferences available to every feature (Priority: P3)

A user's display choices (icon, colour, card style, name attribute, visible columns) apply wherever a feature reads them, and an app can choose where they are stored.

**Why this priority**: Several features read preferences, so they cannot live in one feature. It is independent of the page work.

**Independent Test**: Set a preference, reload: it applies. Start the app with a different storage: it is stored there instead.

**Acceptance Scenarios**:

1. **Given** a user choice, a backend value and a default from the profile, **Then** the user's choice wins, then the backend's, then the default.
2. **Given** an app without configuration screens, **Then** no screen offers changes, and changes the user made before still apply.
3. **Given** a test or an app that provides its own storage, **Then** preferences are stored there, not in the browser.
4. **Given** a feature, **Then** it reads preferences itself; views do not pass them down.

---

### Edge Cases

- A link whose response carries no profile link, and no profile describes it → the view shows the not-found state, and no name is guessed from the link.
- A link to a resource that is not an entity item or collection → the view shows a not-supported state.
- The same item is opened by name in one place and by link in another while loading → one request.
- A host provides no navigation → views that need it fail loudly in development, not silently do nothing.
- A host turns the toolbar off and the view has actions → the actions are not shown; the host is responsible for offering them.
- A stored list state refers to a field the profile no longer has → the field is ignored and the list shows.
- A split view's child navigates to something its parent cannot show in a pane → the parent decides (for example by delegating to its own host).
- An experimental view uses a feature that a stable view cannot → handled through an experimental copy of the view; see open questions.

## Requirements _(mandatory)_

### Functional Requirements

**Layers and loading**

- **FR-001**: The system MUST have a views layer between the apps and the features, shared by both apps and by custom-track repositories.
- **FR-002**: An app MUST only read the address and pass plain values (entity name, item id, a link, view state) to a view; it MUST NOT load a profile entity or other domain object for a view.
- **FR-003**: Each view MUST offer a way to start loading its data before it shows, from the same target and state the view will receive, so a route can start the loading early.
- **FR-004**: A view MUST load the data the page is about (the profile entity and the item or collection) and pass it to its features; features MUST NOT load that main data again.
- **FR-005**: A feature MAY load additional data that follows from the object it received, only by following links on that object; it MUST NOT build addresses itself.
- **FR-006**: A view MUST show one consistent loading, error and not-found state for its main data, shared by all views.

**Targets and state**

- **FR-007**: Every view MUST accept a target that is either an entity name with an optional item id, or a link from the API.
- **FR-008**: The data layer MUST turn either form of target into the same loaded objects once, when the view starts; the rest of the view MUST NOT see the difference.
- **FR-009**: For a link target, the entity's profile MUST be found by following the profile link in the response, or, when it is absent, by finding which profile describes the resource through its describing links. The entity name MUST NOT be taken from the link text.
- **FR-010**: Loaded data MUST be cached under the item's own link, so the same item opened by name or by link is loaded once and shared.
- **FR-011**: A target MUST only say what to show. What the user is looking at (filters, sort order, page, active tab) MUST be view state, passed separately and defined by each view.
- **FR-012**: A view MUST accept an optional state and an optional change notification. Without a change notification, the view MUST keep its state itself.
- **FR-013**: An app MUST read its address into view state and write state changes back to the address, and MUST be the only layer that knows the address format. A frontend address MUST NOT be accepted as a target.
- **FR-014**: The collection view state MUST hold filters keyed by the search template's field names, an optional sort and an optional page value that is the opaque page key. Requests MUST be built through the search template; no address or sort string is built or parsed by hand.
- **FR-015**: A parent view MUST store each child's state under its own prefix so two panes do not overwrite each other; the exact scheme is an open question.

**Navigation**

- **FR-016**: The host MUST provide one navigation object. Only views read it; a view opens pages only through it. Features MUST NOT read it: they report user actions through callback props, which their view wires to the navigation object. Views and features MUST NOT use the router. Host code (the shells area of the views package: router setup and the app's navigation implementation) and the apps MAY use the router.
- **FR-017**: The navigation object MUST offer six functions: `openHome()`, `openClassifyCreate()`, `openEntityItemCollection(entityName)`, `openItem(entityName, id)`, `openEditItem(entityName, id)` and `openCreateItem(entityName)`. It MAY be extended later. They are implemented page by page: the first three are needed through PR 6, the others arrive with their pages.
- **FR-018**: Opening a collection through the navigation object MUST bring the user back to the list as they left it (filters, sort order, page); views MUST NOT need to know how.
- **FR-019**: Hosts other than the app (the chat assistant, Storybook stories, tests) MUST be able to provide their own navigation. A recording implementation MUST exist for stories and tests.
- **FR-020**: An action only one page needs MAY remain a normal property instead of going through the navigation object.

**Layout and toolbar**

- **FR-021**: Features and views MUST fill the space their parent gives them and MUST be able to shrink so inner lists scroll. They MUST NOT add outer padding or size themselves to the browser window; only the outermost host sets real sizes.
- **FR-022**: Visual snapshot tests MUST render each story in a fixed-size box to check FR-021.
- **FR-023**: A view MUST draw its toolbar (breadcrumbs left, actions right) with the shared toolbar layout; every click MUST go through the navigation object.
- **FR-024**: A host or parent view MUST be able to turn a view's toolbar off. Features MUST NOT draw a toolbar or breadcrumbs.

**Composition**

- **FR-025**: A view MUST be able to contain other views. When each pane is also a page on its own, the parent MUST combine the existing views instead of copying them.
- **FR-026**: A parent MUST give each child its own navigation object, so a child's navigation changes the parent's pane, not the route; children MUST NOT know they are side by side.
- **FR-027**: A parent's preload MUST start the preload of its children, so the route starts everything in one go.

**Stability**

- **FR-028**: The stability tag MUST live on views, not on features. When a stable view needs an experimental feature, an experimental copy of the view MUST be made; a stable view MUST NOT contain an experimental view.
- **FR-029**: The generic app's stability gate MUST stay suspended until go-live.

**Preferences**

- **FR-030**: Display preferences MUST be read through one hook in the data layer, merging in priority order: the user's own changes, the backend's values, then a default worked out from the profile.
- **FR-031**: The preference store MUST be created by the app at startup, with the storage location configurable (the browser's local storage by default).
- **FR-032**: An app that does not offer preference screens MUST still apply changes users already made.
- **FR-033**: Views MUST NOT pass preferences down; features read them through the hook.

**Enforcement and migration**

- **FR-034**: Lint MUST check each layer's imports: apps import features only through views (the design's "apps only import views", read as in Assumptions, to be confirmed in review), features and views never import the router, the UI package never imports features, and stable views never import experimental views.
- **FR-035**: The existing stability lint rule MUST check views instead of features.
- **FR-036**: The router calls in the dashboard, sidebar, profile gate and not-found page MUST be replaced by callback props that the view or host code wires to the navigation object.
- **FR-037**: The two apps MUST share the page logic of every migrated page; a fix to a page MUST NOT need two edits.
- **FR-038**: Migrating a page MUST NOT change what the user sees or how the page behaves.

### Key Entities

- **View**: a unit that owns the composition of one page or pane: its data, its toolbar and the placement of features or child views.
- **Target**: what a view shows, given as names or as a link from the API.
- **View state**: how a view shows it (filters, sort, page, active tab); owned by the view's type, read and written by the host.
- **Host**: whatever shows a view: the app, the chat panel, a Storybook story, or a parent view.
- **Navigation object**: the host-provided set of "open this" actions that views call; features reach it only through callback props.
- **Feature**: one piece of functionality that fills the space it is given and reports actions through callbacks.
- **Display preferences**: icon, colour, card style, name attribute and visible columns for an entity, merged from three layers.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A fix to the item detail page or the collection page is made in one place and is visible in both apps.
- **SC-002**: The migrated route files contain only the mapping from the address to a target and state; none keeps filter, sort, page or dialog logic.
- **SC-003**: Opening the same item by name and by link results in one request for the item.
- **SC-004**: A user can return from an item to its list through the breadcrumb and see the same filters, sort order and page as before, in every case that works today.
- **SC-005**: A list and detail split view lets a user switch items in the right pane with no route change and with one toolbar.
- **SC-006**: Every view and feature story has a visual snapshot in a fixed-size box showing no overflow outside the box.
- **SC-007**: No feature imports the router; the lint check fails on a deliberate violation of each layer rule.
- **SC-008**: The existing end-to-end suite passes unchanged after each migrated page.

## Open questions

These stay open. A team meeting settles them; none is decided here.

1. **Experimental copies and unfinished features.** How do we keep an experimental copy of a view up to date with fixes to the original? And once features carry no stability tag, what stops someone from putting an unfinished feature in a stable view?
2. **Two panes, one address.** Each pane has its own filters, sort and page. Proposal: child views report changes to their parent through the change notification (FR-012), and the app writes them to the address with a prefix per pane. Not yet agreed.
3. **The unsaved-changes guard.** Today it blocks route changes while a form is dirty and turns on the browser's leave prompt; only the create form uses it, and the edit form is next. It does not work when a split view switches the item in a pane (no route change), nor in the chat (no router). Proposal: the feature reports only whether it is dirty; the view asks the navigation object to guard leaving and shows the confirm dialog; each host decides how. In this series the guard stays where it is.
4. **Preferences.** (a) A list setting a user changed, such as visible columns, replaces the backend's list as a whole, so a column the backend adds later never shows for that user; a reset per setting is needed, not only "reset all". (b) Can the backend lock a preference so users cannot change it? (c) Will user preferences move to the server so they follow the user across devices? (d) Moving the store makes the data layer depend on the state library as a peer dependency (ADR-007); is that acceptable?
5. **Filters in a link.** If the chat backend sends a search link that already contains filters, does the filter form start empty, or does the backend send the filters separately? Reading them back out of the link would mean parsing it.
6. **New tab for create.** The item page today opens "create a new related item" in a new tab. Does `openCreateItem(entityName)` carry new-tab semantics, does it take an option, or does the host decide?

## Assumptions

- The design approved on 2026-10-06 is the source of the requirements; the six open questions above are the only unsettled points.
- The design says "apps only import views". This spec reads it as: apps do not import the features package directly. Apps still import the data and UI packages for their own bootstrap (configuration, authentication, router context, providers). This reading is to be confirmed in review.
- The navigation functions the design lists are home, classify-create, collection, item, edit item and create item. The first PRs only need `openHome`, `openEntityItemCollection` and `openItem`; the others arrive with the pages that use them.
- The router-setup code in the shells (router creation, the app component, opening a page in a new tab) is router-bound host code. "Features never import the router" therefore requires it to leave the features package first. It moves to the shells area of the views package (`packages/views/src/shells/`), together with the app's navigation implementation if it lives there. That host code and the apps MAY use the router; views and features MAY NOT. This reading is to be confirmed in review.
- Stripping the toolbar from the collection feature happens before the collection view gets its state, so a thin collection view that draws the toolbar is needed in between.
- "Features never import views" is inferred from "each layer imports only from the layers below it"; the design does not state it separately.
- Once the stability tag leaves features, the rule "a stable feature never imports an experimental feature" has no mechanism. It stays as written until stability moves to views, and what replaces it is open question 1.
- Existing pages keep their behaviour while they move; no visual change is intended, so existing snapshot baselines should not change except where a view starts drawing what a feature drew.
- Custom-track repositories (ADR-013) consume the views package like the other packages.
- Pre-GA, new views may start at any stability tier, as new features do today (ADR-006 amendment).
