# Tasks: Views Layer Between Apps and Features

**Input**: Design documents from `/specs/005-views-layer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Each PR carries MSW-backed hook tests, component tests, Storybook stories with visual snapshots in a fixed-size box (ADR-009) and keeps the existing e2e suite green.

**Organization**: PR 1 (this one) is the documents. The remaining work is one phase per stacked PR, PR 2 to PR 8. Every task cites the requirement (FR) and contract it traces to (constitution Principle IX). A PR that departs from this list amends it in the same PR.

**Removed/merged**: the series originally stacked ten PRs, with a PR 3 for a shared `navigator-data` "target resolution" mechanism (`ViewTarget`, `ResolvedViewTarget`). Review concluded views should resolve their own data through `navigator-data`'s existing hooks instead, with no shared target type; that PR (and its tasks, T007–T012) is dropped, not deferred. A second round folded the collection view's state (originally its own PR 5) into the item detail view's PR, now PR 3, because the reference implementation (ACC-3216 PR #246) builds both views together, sharing the same by-name-or-by-link target hooks and breadcrumb components; PRs 6–9 are renumbered 5–8 below. Task IDs are kept as they were through both rounds, per this file's own task-ID stability, rather than renumbered — so PR 3's phase below contains T013–T020 and T016a (the original item detail tasks) followed by T027–T034 (the original collection-state tasks), not a contiguous range.

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

- [ ] T001 [PR 2] Create `packages/views` (`package.json` with per-view `exports` and peer dependencies mirroring `packages/features`, `tsconfig`, `eslint.config.js`, Vitest and Storybook setup, `CLAUDE.md` with the layer rules); register the workspace and update the lockfile importer entry (CODEOWNERS review). Traces: FR-001; plan.md project structure.
- [ ] T002 [P] [PR 2] Add `packages/views/src/types/view.tsx` with only the bits every view's props share — `ViewProps = { toolbar?: ViewToolbarConfiguration }`, where `ViewToolbarConfiguration` is `{ actions?: ReactNode } | false | undefined` — plus the router-context type each view's preload takes. There is no shared `ViewProps<S>`/`ViewPreload<S>`/`ViewTarget` type; each view declares its own props, state and preload signature alongside that view. Traces: FR-007, FR-011, FR-012; contracts `view-props-and-state.md`, `view-data-loading.md`, `view-toolbar.md`.
- [ ] T003 [P] [PR 2] Add the navigation context, provider and `useViewNavigation()` in `packages/views/src/navigation/` with `openHome`, `openEntityItemCollection(entityName)`, `openItem(entityName, id)`; every function accepts an optional trailing `NavigationOptions` (`{ openInNewTab?: boolean }`, default `false`); a missing provider throws in development. Traces: FR-016, FR-017; contract `navigation-context.md` rules 1, 3, 5.
- [ ] T004 [PR 2] Add the recording navigation fake and a Storybook decorator in `packages/views/src/navigation/recording-navigation.tsx`; tests for call order and arguments, including the `NavigationOptions` argument. Traces: FR-019; contract `navigation-context.md` test obligations. Depends on T003.
- [ ] T005 [P] [PR 2] Add the per-child provider helper a parent view uses to give each child its own navigation object, with a unit test. Traces: FR-026; contract `navigation-context.md` rule 6. Depends on T003.
- [ ] T006 [PR 2] Document the package in its `CLAUDE.md` and add a pointer from the root and `packages/features` `CLAUDE.md` files to ADR-018. Traces: FR-001; Principle IX (docs only reference repo paths).

**Checkpoint**: `pnpm -r typecheck` and the package tests pass; no app uses the package yet.

---

## Phase PR 3: item detail view and collection view with state

**Purpose**: the first two pages moved, proving the layer; both apps use them. Supersedes the dropped "navigator-data target resolution" PR (T007–T012, removed): both views take explicit props — `{ entityName, itemId }` or `{ itemUrl }` for the item detail view, `{ entityName }` or `{ collectionUrl }` for the collection view — and resolve their own data directly through small view-local hooks (`useEntityItemTarget`, `useProfileEntityTarget` in `packages/views/src/hooks/`), built on `navigator-data`'s existing hooks and query factories — there is no shared target type or resolution helper. Filters, sort and page live in the collection view's own state from the start, not as a later step.

- [ ] T013 [PR 3] Create `packages/views/src/hooks/use-profile-entity-target.ts` (`useProfileEntityTarget({ entityName } | { url })`, resolving by matching `navigator-data`'s loaded profiles through `ProfileEntity.describesUrl`, `pending | not-found | success`) and `use-entity-item-target.ts` (`useEntityItemTarget({ entityName, itemId } | { itemUrl })`, built on it and `navigator-data`'s `useEntityItem` — which now accepts a still-undefined `profileEntity` so both modes share one hook call shape — `pending(profileEntity?) | not-found | error | success`). Create the item detail view in `packages/views/src/entity-item-detail/` taking `EntityItemDetailViewProps = ViewProps & EntityItemTarget` and rendering its own loading, error and not-found state for its main data with the shared `LoadingPage`/`ErrorPage` components. Traces: FR-004, FR-006, FR-007, FR-008, FR-009, FR-010; contract `view-props-and-state.md`.
- [ ] T014 [PR 3] Export the view's own preload (`preloadEntityItemDetail(ctx, entityName, itemId)`, by-name mode only), built around `navigator-data`'s `ensureProfileEntity`/`ensureEntityItem` over `ensureQueryData`; call it from both apps' `$entity/$itemId` loaders in place of `ensureEntityItemDetailLoaderData`. Traces: FR-003, FR-027; contract `view-data-loading.md`. Depends on T013.
- [ ] T015 [P] [PR 3] Move the relation-problem dialog out of `apps/navigator/src/routes/_app/$entity/$itemId.tsx` into the view, with its tests. Traces: FR-037; user story 1 scenario 3.
- [ ] T016 [PR 3] Add the shared breadcrumb building blocks in `packages/views/src/breadcrumbs/` (`HomeBreadcrumb`, `CollectionBreadcrumb`, `ItemBreadcrumb`, nesting via `children` — a crumb with children is a link, the last is the current page, and a crumb draws nothing until its own data is known) and the item detail page's export (`EntityItemDetailBreadcrumbs`); draw the view's toolbar from them through `useViewNavigation()` in every state, each crumb appearing as soon as its data is known; accept `toolbar?: ViewToolbarConfiguration` to hide it or add host actions. Traces: FR-023, FR-024; contracts `navigation-context.md` rule 3, `view-toolbar.md` rules 1–3. Depends on T013.
- [ ] T016a [PR 3] Wire the item feature's existing `onRelationItemCreateNew` callback to `navigation.openCreateItem(targetEntityName)` inside the view; the view does not re-expose a separate create-new prop of its own. Traces: FR-017; contract `navigation-context.md` (openCreateItem row); open question 6 (resolved: the view passes `{ openInNewTab: true }`). Depends on T013, T017.
- [ ] T017 [PR 3] Add the app's own `Navigation` implementation (`openHome`, `openEntityItemCollection` with the list-restore memo, `openItem`, `openCreateItem`) as a provider in both apps' root route, each as a TanStack file-route-ignored file (`apps/navigator/src/routes/-router-navigation-provider.tsx`, mirrored in `apps/navigator-experimental`) — not in `packages/views/src/shells/`, since a view's hardcoded route strings only typecheck against an app's own registered route tree (research.md §2.7). Traces: FR-016, FR-017, FR-018; contract `navigation-context.md` rule 2. Depends on T003.
- [ ] T018 [PR 3] Reduce both apps' `$entity/$itemId` routes to: read params, call `preloadEntityItemDetail(ctx, entityName, itemId)`, render the view with its explicit props. Delete the duplicated page code; keep the routes' existing tests passing or move them to the view. Traces: FR-002, FR-037, FR-038, SC-001, SC-002. Depends on T013–T017.
- [ ] T019 [P] [PR 3] Stories and tests for the item detail view with the recording navigation fake, including the problem dialog, the create-missing-target wiring, a hidden toolbar, and opening by `itemUrl` instead of `entityName`/`itemId` (same page, one request, shared cache key). Traces: FR-008, FR-010, FR-019, FR-022; contract `view-toolbar.md` test obligations.
- [ ] T020 [PR 3] Run the existing e2e suite for the item detail flow in both apps; no behaviour change. Traces: FR-038, SC-008.
- [ ] T027 [PR 3] Define `CollectionViewState` (`{ filters?, sort?, pageUrl? }`) and `EntityItemCollectionTarget` (`{ entityName } | { collectionUrl }`); create `EntityItemCollectionView` in `packages/views/src/entity-item-collection/`, resolving its target with `useProfileEntityTarget` (T013) — the collection view resolves only the profile, not a page of items — and make it controlled or internal per `state`/`onStateChange`. Traces: FR-008, FR-011, FR-012, FR-014; contracts `view-props-and-state.md`, data-model.md. Depends on T013.
- [ ] T028 [PR 3] Give the view its own toolbar via the shared breadcrumb building blocks (T016) and `EntityItemCollectionBreadcrumbs`, plus a Create action gated on `profileEntity.createTemplate`; place the existing `entity-item-collection` feature under it, passing it the resolved profile and the view's `filters`/`sort`/`pageUrl`, wiring its `onFiltersChange`/`onSortChange`/`onPageChange` back into the view's state (a filter or sort change resets `pageUrl`) and its `onEntityItemClick` to `navigation.openItem`. Traces: FR-004, FR-014, FR-023; contract `view-toolbar.md`. Depends on T027.
- [ ] T029 [PR 3] Build requests through `searchTemplate`; ignore state keys the profile no longer has; `pageUrl` stays an opaque link, never decoded. For a `collectionUrl` target, extract the filter values it carries for the search template's own fields into the view's initial state (`extractFilterValuesFromCollectionUrl`), with `pageUrl` set to that same link (open question 5, resolved). Traces: FR-014; contract `view-props-and-state.md` collection state. Depends on T027.
- [ ] T030 [PR 3] Export the collection view's own preload (`preloadEntityItemCollection(ctx, entityName)`), preloading only the profile the view itself resolves (`ensureProfileEntity`) — the collection feature fetches the page itself, so there is nothing else to preload before mount; use it from both apps' collection loaders. Traces: FR-003; contract `view-data-loading.md`. Depends on T027.
- [ ] T031 [PR 3] In both apps, read the search params into `state` and write `onStateChange` back to the address; the apps stay the only place that knows the address format. Traces: FR-013; contract `view-props-and-state.md` rule 6. Depends on T027.
- [ ] T032 [PR 3] Make `openEntityItemCollection` in the app navigation implementation restore filters, sort and page from the memo. Traces: FR-018, SC-004; contract `navigation-context.md` rule 2. Depends on T017, T028.
- [ ] T033 [P] [PR 3] Tests: filter change resets the page; address with filters applies them; breadcrumb round trip restores state; internal state without `onStateChange`; entity switch does not leak state; opening by `collectionUrl` seeds `filters` and `pageUrl` from the link. Traces: user story 2 scenarios 1–5, SC-004; user story 3 scenario 4.
- [ ] T034 [PR 3] Reduce both apps' collection routes to the address-to-state mapping, the loader and the view; delete the duplicated code. Traces: FR-002, FR-037, SC-001, SC-002. Depends on T028–T031.

**Checkpoint**: the item detail and collection pages work in both apps, each from one view; fixes land once. Filters, sort and page live in the collection view's own state from the start — there is no separate "add state later" step.

---

## Phase PR 4: strip layout from features

**Purpose**: features fill their space; views draw the page chrome. The item detail view already renders the body-only `EntityItemContentFocusBody` export instead of the full page component (PR 3), and the collection view already passes the collection feature its state directly (PR 3); this phase removes the now-unused `toolbar`/`breadcrumbs`/`actions` props and `PageLayout`/`BreadCrumbsToolBarLayout` wrapping from the full-page feature components themselves, so nothing in the features package can still be rendered as a forced full page. It goes one step further than layout-only stripping: `EntityItemView` also drops its own `useEntityItem` call in favor of an already-loaded `item` prop, and the two self-fetching wrappers this made redundant (`EntityItemContentFocusView`, `EntityItemCollectionSearchView`) are removed outright rather than left as unused dead code.

- [ ] T021 [PR 4] Remove `toolbar`, `breadcrumbs`, `actions` props and the `PageLayout` and `BreadCrumbsToolBarLayout` wrapping from `EntityItemView` (and the content-focus variation's `EntityItemContentFocusBody`) in `packages/features/src/entity-item/`; go further than dropping layout props and also remove `EntityItemView`'s own `useEntityItem` call, so it takes an already-loaded `item: EntityItem` prop instead (the view above it resolves and owns loading); make the root fill its parent (`h-full min-h-0`, no outer padding, no window-sized units). The self-fetching, toolbar-drawing `EntityItemContentFocusView` wrapper (by `entityName`/`itemId`) is removed outright once the item detail view hands `EntityItemContentFocusBody` an already-loaded item directly — nothing else called it. Traces: FR-021, FR-024; contract `view-toolbar.md` rules 4, 5.
- [ ] T022 [P] [PR 4] Remove `EntityItemCollectionSearchView` in `packages/features/src/entity-item-collection/` outright rather than stripping it: it only ever wrapped the already-chrome-free `EntityItemCollectionView` in a toolbar/`PageLayout`, so once the views layer places `EntityItemCollectionView` directly there is nothing left for the wrapper to do. Traces: FR-021, FR-024; contract `view-toolbar.md` rules 4, 5.
- [ ] T023 [PR 4] Rewire the item detail view to pass `EntityItemContentFocusBody` the `entityItem` it already resolved (via `useEntityItemTarget`/`useEntityItem`) instead of the removed self-fetching wrapper — this is a real code change, not a no-op verification, because `EntityItemView`'s reduced API (T021) means the view must now also own the "no content attributes" fallback data flow it previously delegated. Traces: FR-023; contract `view-toolbar.md`. Depends on T021.
- [ ] T024 [PR 4] Rewire the collection view to import `EntityItemCollectionView` directly from `@contentgrid/features/entity-item-collection` now that `EntityItemCollectionSearchView` (T022) is gone, passing it the resolved profile and its own state (`filters`/`sort`/`pageUrl`) under its own breadcrumb toolbar. Traces: FR-023; contract `view-toolbar.md`. Depends on T022.
- [ ] T025 [P] [PR 4] Render every affected story in a fixed-size box in the visual snapshot harness; update baselines in the pinned image with `--update-snapshots=all` and verify there is no overflow. Traces: FR-022, SC-006; contract `view-toolbar.md` test obligations.
- [ ] T026 [PR 4] Check that no other caller passes the removed props; update `packages/features/CLAUDE.md` rules for layout. Traces: FR-024; Principle IX (docs track the code).

**Checkpoint**: features render in any box; the pages look the same.

---

## Phase PR 5: move shells and layout; remove router calls

**Purpose**: page composition leaves the features package; features stop navigating.

- [ ] T035 [PR 5] Move `packages/features/src/layout/` into `packages/views/src/layout/` with its stories, tests and export paths; update imports. Traces: FR-001, FR-036; contract `layer-lint-rules.md` (layers).
- [ ] T036 [PR 5] Move `packages/features/src/shells/` (`auth-shell`, `entity-profile-gate`, `router-shell`) into `packages/views/src/shells/`; router setup stays host code there that may use the router (views and features may not). The app's own `Navigation` implementation is a separate concern and is not moved here — it already lives under each app's own `src/routes/` since PR 3 (T017). Traces: FR-001, FR-006; plan.md structure.
- [ ] T037 [P] [PR 5] Replace the router calls in the sidebar (`sidebar-layout.tsx`, `sidebar-entity-nav.tsx`) with callback props (home, entity, create, settings); the shell view in `packages/views/src/shells/` wires them to `useViewNavigation()`, which gains only what they need. Traces: FR-016, FR-036; contract `navigation-context.md`. Depends on T035.
- [ ] T038 [P] [PR 5] Replace the router calls in the dashboard entity count overview and the not-found page with callback props (open entity, back to home); the view that shows them wires these to `useViewNavigation()`. Traces: FR-016, FR-036; contract `navigation-context.md`.
- [ ] T039 [PR 5] Replace the router calls in the profile gate with callback props wired by the views that use it to `useViewNavigation()`; each view keeps rendering its own loading, error and not-found state with the shared `LoadingPage`/`ErrorPage` components, no shared gate. Traces: FR-006, FR-036. Depends on T036.
- [ ] T040 [PR 5] Leave `useUnsavedChangesGuard` and the create form as they are; add a note in `packages/views/CLAUDE.md` that its home is open question 3. Traces: spec.md open question 3.
- [ ] T041 [PR 5] Add `openClassifyCreate` and `openEditItem` to the navigation object only where a moved caller needs them, with app implementations and recording fake support (`openCreateItem` already exists from PR 3). Traces: FR-017; contract `navigation-context.md`.
- [ ] T042 [P] [PR 5] Update `apps/*` imports (`@contentgrid/features/router-shell` etc.) to the views exports; remove the now-empty features export paths. Traces: FR-001, FR-037.
- [ ] T043 [PR 5] Run visual snapshots and e2e; verify with `pnpm -r typecheck`. Traces: FR-038, SC-006, SC-008.

**Checkpoint**: no feature except the unsaved-changes guard imports the router.

---

## Phase PR 6: list and detail split view

**Purpose**: the first view composed of two views. PR 6 is limited to the view and its story; no route is added until open question 2 is settled.

- [ ] T044 [PR 6] Create the split view in `packages/views/src/entity-item-split/` composed of the collection view and the item detail view, both with their toolbars off and one toolbar drawn by the parent. Traces: FR-024, FR-025; contract `view-toolbar.md` rule 3, user story 4.
- [ ] T045 [PR 6] Give each child its own navigation object: the list's `openItem` shows the item in the detail pane and does not change the route; other calls go to the parent's navigation. Traces: FR-026; contract `navigation-context.md` rule 6. Depends on T044.
- [ ] T046 [PR 6] Store each child's state under its own prefix in the parent's state, and report it through `onStateChange`; keep the address scheme out of the view. Traces: FR-015; contract `view-props-and-state.md` rule 8; open question 2.
- [ ] T047 [PR 6] Export the parent's preload that calls both children's preload. Traces: FR-027; contract `view-data-loading.md` rule 5. Depends on T044.
- [ ] T048 [PR 6] _Optional follow-up, after open question 2 (two panes, one URL) is settled:_ add a route in the experimental app for the split view. New pages are out of scope for this series, so PR 6 ships the composed view and its story only. Traces: FR-013; user story 4.
- [ ] T049 [P] [PR 6] Stories in a fixed-size box and tests: select two items in turn, no route change, one toolbar, independent state per pane. Traces: FR-022, SC-005, SC-006.

**Checkpoint**: a list and detail split works with both children unaware of each other.

---

## Phase PR 7: preferences move into a user-preferences feature

**Purpose**: preferences become available to every feature, with configurable storage. Open question 4d (a peer dependency in `navigator-data`) is resolved: the store stays inside `packages/features`, which already depends on Zustand, so PR 7 is not gated on a team answer.

- [ ] T050 [PR 7] Reorganise `packages/features/src/preferences/` into its own `packages/features/src/user-preferences/` feature (merge logic, `useEntityDisplayPreferences`, `useColumnVisibility`, `resolve-entity-icon`, attribute options); keep exports stable for callers through the barrel. `navigator-data` keeps the `EntityDisplayPreferences` type and the backend fetch it already has, unchanged. Traces: FR-030, FR-033.
- [ ] T051 [PR 7] Turn the store into a factory taking a storage option (local storage by default), with the persisted key unchanged so existing choices keep working. No peer dependency to add: `packages/features` already depends on Zustand. Traces: FR-031. Depends on T050.
- [ ] T052 [PR 7] Create the store at startup in both apps and provide it to the hooks; tests supply an in-memory storage. Traces: FR-031, FR-032. Depends on T051.
- [ ] T053 [P] [PR 7] Keep the backend part as it is (returns nothing); add a test that the three layers merge in priority order. Traces: FR-030; user story 7 scenario 1.
- [ ] T054 [PR 7] Make the configuration screens optional in the app; with none, changes users already made still apply. Traces: FR-032; user story 7 scenario 2. Depends on T052.
- [ ] T055 [P] [PR 7] Update `packages/features/CLAUDE.md` (the feature is renamed `preferences` → `user-preferences`) and `packages/navigator-data/CLAUDE.md` (confirm it documents only the type and the backend part). Traces: Principle IX (docs track the code).

**Checkpoint**: features read preferences through the hook; storage is chosen by the app.

---

## Phase PR 8: stability on views and layer lint rules

**Purpose**: the tag follows what users get, and the layers are enforced.

- [ ] T056 [PR 8] Add `x-stability` to each view's `package.json`; remove it from feature directories; keep `dev-tools` as today. Traces: FR-028; constitution Principle IV (amended).
- [ ] T057 [PR 8] Change `no-unstable-features` to resolve and check views; update its options, tests and fixtures. Traces: FR-035; contract `layer-lint-rules.md` L6.
- [ ] T058 [PR 8] Keep the generic app's gate suspended: `allowedStability` stays at all three tiers; update the comment in `apps/navigator/eslint.config.js` and the ADR-006 amendment's go-live steps to name views. Traces: FR-029; ADR-006 amendment.
- [ ] T059 [P] [PR 8] Add layer lint rules L1 to L5 to `packages/eslint-config` with a failing and a passing fixture per rule; L4 (features, the UI package and `navigator-data` never import `packages/views`) needs one fixture pair per importing layer, not just features. Traces: FR-034; contract `layer-lint-rules.md`.
- [ ] T060 [PR 8] Enable the rules in each package's and app's ESLint config; fix any remaining violation. Traces: FR-034, SC-007. Depends on T059.
- [ ] T061 [PR 8] Mark the experimental-copy convention in `packages/views/CLAUDE.md` as provisional pending open question 1; update `packages/features/CLAUDE.md`, `apps/navigator/CLAUDE.md` and `apps/navigator-experimental/CLAUDE.md` promotion text. Traces: FR-028; spec.md open question 1.
- [ ] T062 [PR 8] Amend the constitution (Principles III and IV, version bump per Governance) if review of the open questions changes the stability or layer rules. Traces: Principle IX; Governance (amendment).

**Checkpoint**: lint fails on each deliberate violation; the real code is clean.

---

## Dependencies & Execution Order

- PR 2 has no dependency.
- PR 3 needs PR 2.
- PR 4 needs PR 3.
- PR 5 needs PR 4.
- PR 6 needs PR 5: it composes the item detail and collection views (already built in PR 3) and the moved layout/shells (PR 5); both are already in place by PR 6's position in the stack.
- PR 7 is independent of PRs 3–6 and is stacked after them only to keep the series linear.
- PR 8 is last.
- Each PR keeps both apps working and the e2e suite green.

## Notes

- Do not add tasks without an FR or contract anchor; add the anchor to the spec first.
- Open questions in `spec.md` stay open until the team settles them, except question 5, resolved by what PR 3 actually built; tasks that touch the rest say so and keep the current behaviour.
- Updating visual baselines needs the pinned image; use `--update-snapshots=all`.
