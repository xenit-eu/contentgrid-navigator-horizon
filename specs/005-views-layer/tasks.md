# Tasks: Views Layer Between Apps and Features

**Input**: Design documents from `/specs/005-views-layer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Each PR carries MSW-backed hook tests, component tests, Storybook stories with visual snapshots in a fixed-size box (ADR-009) and keeps the existing e2e suite green.

**Organization**: PR 1 (this one) is the documents. The remaining work is one phase per stacked PR, PR 2 to PR 10. Every task cites the requirement (FR) and contract it traces to (constitution Principle IX). A PR that departs from this list amends it in the same PR.

## Format: `[ID] [P?] [PR] Description (FR, contract)`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[PR n]**: the stacked PR the task belongs to
- Contracts are in `specs/005-views-layer/contracts/`

## Path Conventions

pnpm monorepo: `packages/views/src/**`, `packages/navigator-data/src/**`, `packages/features/src/**`, `packages/eslint-config/**`, `apps/navigator*/src/**`, `docs/adr/**`.

Pre-GA the generic app's stability gate stays suspended; no task reinstates it.

---

## Phase PR 2: `packages/views` scaffold

**Purpose**: the package, the navigation context and the shared types, with no page moved yet.

- [x] T001 [PR 2] Create `packages/views` (`package.json` with per-view `exports` and peer dependencies mirroring `packages/features`, `tsconfig`, `eslint.config.js`, Vitest and Storybook setup, `CLAUDE.md` with the layer rules); register the workspace and update the lockfile importer entry (CODEOWNERS review). Traces: FR-001; plan.md project structure.
- [x] T002 [P] [PR 2] Add `ViewProps<S>`, `ViewPreload<S>` and the `ViewTarget` type in `packages/views/src/types.ts`. Traces: FR-007, FR-011, FR-012; contracts `view-target.md`, `view-props-and-state.md`, `view-preload.md`.
- [x] T003 [P] [PR 2] Add the navigation context, provider and `useNavigation()` in `packages/views/src/navigation/` with `openHome`, `openEntityItemCollection(entityName)`, `openItem(entityName, id)`; a missing provider throws in development. Traces: FR-016, FR-017; contract `navigation-context.md` rules 1, 3, 5.
- [x] T004 [PR 2] Add the recording navigation fake and a Storybook decorator in `packages/views/src/navigation/testing.tsx`; tests for call order and arguments. Traces: FR-019; contract `navigation-context.md` test obligations. Depends on T003.
- [x] T005 [P] [PR 2] Add the per-child provider helper a parent view uses to give each child its own navigation object, with a unit test. Traces: FR-026; contract `navigation-context.md` rule 6. Depends on T003.
- [x] T006 [PR 2] Document the package in its `CLAUDE.md` and add a pointer from the root and `packages/features` `CLAUDE.md` files to ADR-018. Traces: FR-001; Principle IX (docs only reference repo paths).

**Checkpoint**: `pnpm -r typecheck` and the package tests pass; no app uses the package yet.

---

## Phase PR 3: navigator-data target resolution

**Purpose**: one place that turns a `ViewTarget` into loaded objects.

- [x] T007 [P] [PR 3] Add the target resolution helpers in `packages/navigator-data/src/views/`: name target to `ProfileEntity` (and `EntityItem` with `itemId`). Traces: FR-007, FR-008; contract `view-target.md` (Resolution, name target).
- [x] T008 [PR 3] Add link target resolution: fetch the link, find the profile through the response's profile link, fall back to the profiles whose `describes` link covers the resource; not-found outcome when none; no URL parsing. Traces: FR-009; contract `view-target.md`. Depends on T007.
- [x] T009 [PR 3] Cache loaded items under the item's self link, shared by both target forms; add the query key family and a test that a name and a link for the same item cause one request. Traces: FR-010, SC-003; contract `view-target.md` (Caching). Depends on T007, T008.
- [x] T010 [P] [PR 3] Add a hook and an `ensure*` function over the same keys, for views and for preloads. Traces: FR-003, FR-004; contracts `view-target.md`, `view-preload.md` rule 6. Depends on T009.
- [x] T011 [PR 3] MSW tests: name target, link target with profile link, link target through `describes`, no profile (not-found), non-entity link (not-supported), problem responses narrowed with the provided guards. Traces: FR-008, FR-009; contract `view-target.md` (Errors). Depends on T010.
- [x] T012 [PR 3] Export the helpers from the package barrel and add a "View targets" section to `packages/navigator-data/CLAUDE.md`. Traces: FR-008; Principle III (explicit named exports).

**Checkpoint**: both target forms resolve to the same objects and cache entries; no view uses them yet.

---

## Phase PR 4: item detail view

**Purpose**: the first page moved, proving the layer; both apps use it.

- [x] T013 [PR 4] Create the item detail view in `packages/views/src/entity-item-detail/` taking `ViewProps` and resolving its data through the PR 3 hook; one shared loading, error and not-found gate for its main data. Traces: FR-004, FR-006; contracts `view-props-and-state.md`, `view-target.md`. _As built: the gate is `ViewTargetGate` in `packages/views/src/gate/`; it keeps the toolbar around loading and error states once the profile is known (`useViewTarget` also returns `profileEntity`). The view takes `hideToolbar` and `onRelationItemCreateNew` beside `ViewProps`._
- [x] T014 [PR 4] Export the view's `preload` and use it from both apps' `$entity/$itemId` loaders; remove `ensureEntityItemDetailLoaderData` use from the routes. Traces: FR-003, FR-027; contract `view-preload.md`. Depends on T013. _As built: the item feature's own `useEntityItem` still revalidates on mount (stale time 0), so a preload removes the loading state but not that background request; PR 5 passes the loaded item down._
- [x] T015 [P] [PR 4] Move the relation-problem dialog out of `apps/navigator/src/routes/_app/$entity/$itemId.tsx` into the view, with its tests. Traces: FR-037; user story 1 scenario 3.
- [x] T016 [PR 4] Draw the view's toolbar (home and collection breadcrumbs) through `useNavigation()`; accept a prop to hide it. Traces: FR-023, FR-024; contracts `navigation-context.md` rule 3, `view-toolbar.md` rules 1–3. Depends on T013. _As built: breadcrumbs are buttons that call the navigation object, so they no longer have an `href` (no open-in-new-tab from the crumb)._
- [x] T017 [PR 4] Add the app navigation implementation (`openHome`, `openEntityItemCollection` with the list-restore memo, `openItem`) as a provider in both apps' root route. Traces: FR-016, FR-018; contract `navigation-context.md` rule 2. Depends on T003. _As built: the provider is `AppNavigationProvider` in each app's `src/app-navigation.tsx`, mounted in the app shell inside `AuthShell`; it moves to `packages/views/src/shells/` with PR 7._
- [x] T018 [PR 4] Reduce both apps' `$entity/$itemId` routes to: read params, build a `name` target, call `preload`, render the view. Delete the duplicated page code; keep the routes' existing tests passing or move them to the view. Traces: FR-002, FR-037, FR-038, SC-001, SC-002. Depends on T013–T017.
- [x] T019 [P] [PR 4] Stories and tests for the view with the recording navigation fake, including the problem dialog and a hidden toolbar. Traces: FR-019, FR-022; contract `view-toolbar.md` test obligations.
- [ ] T020 [PR 4] Run the existing e2e suite for the item detail flow in both apps; no behaviour change. Traces: FR-038, SC-008. _Not run in PR 4: the e2e suite needs a backend; the page was exercised in a browser against the demo mock backend instead (see the PR description)._

**Checkpoint**: the item detail page works in both apps from one view; fixes land once.

---

## Phase PR 5: strip layout from features

**Purpose**: features fill their space; views draw the page chrome.

- [ ] T021 [PR 5] Remove `toolbar`, `breadcrumbs`, `actions` props and the `PageLayout` and `BreadCrumbsToolBarLayout` wrapping from `EntityItemView` (and the content-focus variation) in `packages/features/src/entity-item/`; make the root fill its parent (`h-full min-h-0`, no outer padding, no window-sized units). Traces: FR-021, FR-024; contract `view-toolbar.md` rules 4, 5.
- [ ] T022 [P] [PR 5] Do the same for `EntityItemCollectionSearchView` in `packages/features/src/entity-item-collection/`. Traces: FR-021, FR-024; contract `view-toolbar.md` rules 4, 5.
- [ ] T023 [PR 5] Update the item detail view to place the item feature in the space under its toolbar. Traces: FR-023; contract `view-toolbar.md`. Depends on T021.
- [ ] T024 [PR 5] Add a thin collection view in `packages/views/src/entity-item-collection/` that draws the toolbar (home breadcrumb, entity name, "Create" action) through `useNavigation()` and places the collection feature; the route keeps passing today's filter, sort and page props until PR 6. Traces: FR-023, FR-037; contract `view-toolbar.md`. Depends on T022.
- [ ] T025 [P] [PR 5] Render every affected story in a fixed-size box in the visual snapshot harness; update baselines in the pinned image with `--update-snapshots=all` and verify there is no overflow. Traces: FR-022, SC-006; contract `view-toolbar.md` test obligations.
- [ ] T026 [PR 5] Check that no other caller passes the removed props; update `packages/features/CLAUDE.md` rules for layout. Traces: FR-024; Principle IX (docs track the code).

**Checkpoint**: features render in any box; the pages look the same.

---

## Phase PR 6: collection view with view state

**Purpose**: filters, sort and page move out of the route.

- [ ] T027 [PR 6] Define `CollectionViewState` in `packages/views/src/entity-item-collection/` and make the collection view controlled or internal per `ViewProps`. Traces: FR-011, FR-012, FR-014; contracts `view-props-and-state.md`, data-model.md.
- [ ] T028 [PR 6] Move the filter, sort and page logic (including the session memo through `remember*`/`recall*`) from `apps/navigator/src/routes/_app/$entity/index.tsx` into the view and the navigator-data helpers; no behaviour change. Traces: FR-004, FR-018, FR-038; contract `navigation-context.md` rule 2. Depends on T027.
- [ ] T029 [PR 6] Build requests through `searchTemplate`; ignore state keys the profile no longer has; page value stays an opaque key. Traces: FR-014; contract `view-props-and-state.md` collection state.
- [ ] T030 [PR 6] Export the collection view's `preload(ctx, target, state)` and use it from both apps' collection loaders. Traces: FR-003; contract `view-preload.md`. Depends on T027.
- [ ] T031 [PR 6] In both apps, read the search params into `state` and write `onStateChange` back to the address; the apps stay the only place that knows the address format. Traces: FR-013; contract `view-props-and-state.md` rule 3. Depends on T027.
- [ ] T032 [PR 6] Make `openEntityItemCollection` in the app navigation implementation restore filters, sort and page from the memo. Traces: FR-018, SC-004; contract `navigation-context.md` rule 2. Depends on T028.
- [ ] T033 [P] [PR 6] Tests: filter change resets the page; address with filters applies them; breadcrumb round trip restores state; internal state without `onStateChange`; entity switch does not leak state. Traces: user story 2 scenarios 1–5, SC-004.
- [ ] T034 [PR 6] Reduce both apps' collection routes to the address-to-state mapping, the loader and the view; delete the duplicated code. Traces: FR-002, FR-037, SC-001, SC-002. Depends on T028–T031.

**Checkpoint**: the collection page is a view with state; the route file only maps the address.

---

## Phase PR 7: move shells and layout; remove router calls

**Purpose**: page composition leaves the features package; features stop navigating.

- [ ] T035 [PR 7] Move `packages/features/src/layout/` into `packages/views/src/layout/` with its stories, tests and export paths; update imports. Traces: FR-001, FR-036; contract `layer-lint-rules.md` (layers).
- [ ] T036 [PR 7] Move `packages/features/src/shells/` (`auth-shell`, `entity-profile-gate`, `router-shell`) into `packages/views/src/shells/`; keep router setup as host-level code there. Traces: FR-001, FR-006; plan.md structure.
- [ ] T037 [P] [PR 7] Replace the router calls in the sidebar (`sidebar-layout.tsx`, `sidebar-entity-nav.tsx`) with `useNavigation()`, adding to the navigation object only what they need. Traces: FR-016, FR-036; contract `navigation-context.md`. Depends on T035.
- [ ] T038 [P] [PR 7] Replace the router calls in the dashboard entity count overview and the not-found page with `useNavigation()` (the not-found page opens home). Traces: FR-016, FR-036; contract `navigation-context.md`.
- [ ] T039 [PR 7] Replace the router calls in the profile gate with `useNavigation()` and make views share it as the single loading, error and not-found gate. Traces: FR-006, FR-036. Depends on T036.
- [ ] T040 [PR 7] Leave `useUnsavedChangesGuard` and the create form as they are; add a note in `packages/views/CLAUDE.md` that its home is open question 3. Traces: spec.md open question 3.
- [ ] T041 [PR 7] Add `openClassifyCreate`, `openEditItem` and `openCreateItem` to the navigation object only where a moved caller needs them, with app implementations and recording fake support. Traces: FR-017; contract `navigation-context.md`.
- [ ] T042 [P] [PR 7] Update `apps/*` imports (`@contentgrid/features/router-shell` etc.) to the views exports; remove the now-empty features export paths. Traces: FR-001, FR-037.
- [ ] T043 [PR 7] Run visual snapshots and e2e; verify with `pnpm -r typecheck`. Traces: FR-038, SC-006, SC-008.

**Checkpoint**: no feature except the unsaved-changes guard imports the router.

---

## Phase PR 8: list and detail split view

**Purpose**: the first view composed of two views.

- [ ] T044 [PR 8] Create the split view in `packages/views/src/entity-item-split/` composed of the collection view and the item detail view, both with their toolbars off and one toolbar drawn by the parent. Traces: FR-024, FR-025; contract `view-toolbar.md` rule 3, user story 4.
- [ ] T045 [PR 8] Give each child its own navigation object: the list's `openItem` shows the item in the detail pane and does not change the route; other calls go to the parent's navigation. Traces: FR-026; contract `navigation-context.md` rule 6. Depends on T044.
- [ ] T046 [PR 8] Store each child's state under its own prefix in the parent's state, and report it through `onStateChange`; keep the address scheme out of the view. Traces: FR-015; contract `view-props-and-state.md` rule 6; open question 2.
- [ ] T047 [PR 8] Export the parent's `preload` that calls both children's `preload`. Traces: FR-027; contract `view-preload.md` rule 5. Depends on T044.
- [ ] T048 [PR 8] Add a route in the experimental app for the split view (route maps the address to the composite state; the address prefix scheme is marked provisional pending open question 2). Traces: FR-013; user story 4.
- [ ] T049 [P] [PR 8] Stories in a fixed-size box and tests: select two items in turn, no route change, one toolbar, independent state per pane. Traces: FR-022, SC-005, SC-006.

**Checkpoint**: a list and detail split works with both children unaware of each other.

---

## Phase PR 9: preferences move to navigator-data

**Purpose**: preferences become available to every feature, with configurable storage.

- [ ] T050 [PR 9] Move the merge logic, `useEntityDisplayPreferences`, `useColumnVisibility`, `resolve-entity-icon` and attribute options from `packages/features/src/preferences/` to `packages/navigator-data`; keep exports stable for callers through the barrel. Traces: FR-030, FR-033.
- [ ] T051 [PR 9] Turn the store into a factory taking a storage option (local storage by default), with the persisted key unchanged so existing choices keep working; add Zustand as a peer dependency of `navigator-data` (ADR-007; open question 4d). Traces: FR-031. Depends on T050.
- [ ] T052 [PR 9] Create the store at startup in both apps and provide it to the hooks; tests supply an in-memory storage. Traces: FR-031, FR-032. Depends on T051.
- [ ] T053 [P] [PR 9] Keep the backend part as it is (returns nothing); add a test that the three layers merge in priority order. Traces: FR-030; user story 7 scenario 1.
- [ ] T054 [PR 9] Make the configuration screens optional in the app; with none, changes users already made still apply. Traces: FR-032; user story 7 scenario 2. Depends on T052.
- [ ] T055 [P] [PR 9] Update `packages/navigator-data/CLAUDE.md` and `packages/features/CLAUDE.md`; remove the empty `preferences` feature directory and its export path. Traces: Principle IX (docs track the code).

**Checkpoint**: features read preferences through the hook; storage is chosen by the app.

---

## Phase PR 10: stability on views and layer lint rules

**Purpose**: the tag follows what users get, and the layers are enforced.

- [ ] T056 [PR 10] Add `x-stability` to each view's `package.json`; remove it from feature directories; keep `dev-tools` as today. Traces: FR-028; constitution Principle IV (amended).
- [ ] T057 [PR 10] Change `no-unstable-features` to resolve and check views; update its options, tests and fixtures. Traces: FR-035; contract `layer-lint-rules.md` L6.
- [ ] T058 [PR 10] Keep the generic app's gate suspended: `allowedStability` stays at all three tiers; update the comment in `apps/navigator/eslint.config.js` and the ADR-006 amendment's go-live steps to name views. Traces: FR-029; ADR-006 amendment.
- [ ] T059 [P] [PR 10] Add layer lint rules L1 to L5 to `packages/eslint-config` with a failing and a passing fixture per rule. Traces: FR-034; contract `layer-lint-rules.md`.
- [ ] T060 [PR 10] Enable the rules in each package's and app's ESLint config; fix any remaining violation. Traces: FR-034, SC-007. Depends on T059.
- [ ] T061 [PR 10] Mark the experimental-copy convention in `packages/views/CLAUDE.md` as provisional pending open question 1; update `packages/features/CLAUDE.md`, `apps/navigator/CLAUDE.md` and `apps/navigator-experimental/CLAUDE.md` promotion text. Traces: FR-028; spec.md open question 1.
- [ ] T062 [PR 10] Amend the constitution (Principles III and IV, version bump per Governance) if review of the open questions changes the stability or layer rules. Traces: Principle IX; Governance (amendment).

**Checkpoint**: lint fails on each deliberate violation; the real code is clean.

---

## Dependencies & Execution Order

- PR 2 has no dependency. PR 3 can start in parallel with PR 2 (different package) but is stacked after it.
- PR 4 needs PR 2 and PR 3. PR 5 needs PR 4. PR 6 needs PR 5. PR 7 needs PR 6. PR 8 needs PR 6 (and PR 7 for the moved layout). PR 9 is independent of PRs 4–8 and is stacked after them only to keep the series linear. PR 10 is last.
- Each PR keeps both apps working and the e2e suite green.

## Notes

- Do not add tasks without an FR or contract anchor; add the anchor to the spec first.
- Open questions in `spec.md` stay open until the team settles them; tasks that touch them say so and keep the current behaviour.
- Updating visual baselines needs the pinned image; use `--update-snapshots=all`.
