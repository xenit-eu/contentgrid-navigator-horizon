---
description: "Task list for the Entity Knowledge Graph feature"
---

# Tasks: Entity Knowledge Graph

**Input**: Design documents from `specs/007-entity-knowledge-graph/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The constitution requires MSW contract tests for every new or changed
navigator-data hook, stories and visual baselines for new ui patterns, and a browser check. The
plan calls for TDD on the pure `util/` layer. For test-first tasks, write the test, see it fail,
then implement.

**Organization**: Tasks are grouped by user story (US1–US7 from spec.md, in priority order).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US7 (spec.md user stories); Setup/Foundational/Polish carry no label
- Paths are repo-relative. Abbreviations used below:
  - `NDATA` = `packages/navigator-data`
  - `UIKG` = `packages/ui/src/patterns/knowledge-graph`
  - `EG` = `packages/features/src/entity-graph`

## Global rules for every task (from the constitution — do not violate)

- Never build or modify a URL, cursor, or page size by hand. URLs come only from HAL links or
  accessor methods (`profileEntity.itemUrl(id)`, `nextHref`). Ids come only from `item.id`.
- `@xyflow/react` and `radix-ui` may be imported **only** in `packages/ui`. `packages/features`
  must not import a Layer-1 `@contentgrid/*` package or `@xyflow/react`.
- `EG/util/` is pure: no JSX, no hooks, no `@contentgrid/ui` import.
- Gate every operation on the permission flags: `canClear` (to-one), `canUnlinkItem`
  (to-many), `canDelete` (item).
- Route every error through `toProblemDisplayModel` → `ProblemAlert`. Never auto-retry a
  403/404/412.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency, styles, test shims, feature scaffold.

- [x] T001 Add `"@xyflow/react": "12.11.6"` (exact pin) to `dependencies` in `packages/ui/package.json` with `pnpm --filter @contentgrid/ui add @xyflow/react@12.11.6`.
  - Do not use `latest`, and do not pick `12.12.0`: it is newer than the 14-day `minimumReleaseAge`.
  - Confirm with `pnpm why @xyflow/react` that exactly `12.11.6` resolves.
  - Confirm that the install printed no build-script prompt and that `onlyBuiltDependencies` in `pnpm-workspace.yaml` is still `[]`.
  - The `pnpm-lock.yaml` diff is CODEOWNERS-reviewed; call it out in the PR.
- [x] T002 In `packages/ui/src/styles/preset.css`, add `@import "@xyflow/react/dist/base.css" layer(base);`.
  - Add a `.react-flow` rule block that maps the React Flow variables onto the existing shadcn tokens:
    - `--xy-background-color` → `var(--background)`
    - `--xy-node-border-default` → `var(--border)`
    - `--xy-edge-stroke-default` → `var(--muted-foreground)`
    - `--xy-edge-label-background-color-default` → `var(--background)`
    - `--xy-controls-button-background-color-default` → `var(--card)`
  - Add dark variants under the existing dark selector.
- [x] T003 [P] Add a `mockReactFlow()` helper to `packages/ui/test-setup.ts`, following the React Flow testing guide:
  - Stub `ResizeObserver`.
  - Stub `DOMMatrixReadOnly`: parse `scale(n)` into `m22`.
  - Stub `HTMLElement.prototype.offsetWidth` / `offsetHeight`: return 100 / 40 for `.react-flow__node`, else 0.
  - Stub `SVGElement.prototype.getBBox`: return `{x:0,y:0,width:0,height:0}`.
  - Call the helper once globally.
- [x] T004 [P] Add the same `mockReactFlow()` shims to `packages/features/test-setup.ts`, next to the existing `ResizeObserver` / `matchMedia` stubs. Keep one ResizeObserver definition.
- [x] T005 [P] Scaffold the feature:
  - `EG/package.json` with `{"x-stability": "stable"}` (pre-GA exception, Principle IV).
  - `EG/index.ts`: an empty barrel for now.
  - Add `"./entity-graph": {"import": "./src/entity-graph/index.ts", "types": "./src/entity-graph/index.ts"}` to the `exports` map in `packages/features/package.json`.

**Checkpoint**: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint` pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data hooks, pure graph core, the ui pattern shell, and shared feature utilities that every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### navigator-data (contracts/navigator-data-hooks.md)

- [x] T006 Add key factories to `NDATA/src/query-keys.ts` and extend `NDATA/src/query-keys.test.ts`:
  - `toOneRelation.all()` → `[ToOneRelation]`
  - `toManyRelation.all()` → `[ToManyRelation]`
  - `toManyRelation.infiniteByUrl(relName, url)` → `[ToManyRelation, relName, url, "infinite"]`
  - Assert that `infiniteByUrl` is prefix-matched by `toManyRelation.forRelationName(relName)`.
- [x] T007 [P] Write the contract test `NDATA/src/hooks/relation/use-entity-item-relation-targets.test.tsx`, using MSW fixtures from `NDATA/test-fixtures/msw/entity-browser-fixtures.ts`:
  - Fixture: an invoice with `supplier` (to-one, set), `lineItems` (to-many, 25 items, `total_items_exact`), one to-one whose target returns 404, and one relation whose `cg:relation` link is absent.
  - Assert exactly 3 entries, in the order to-one first then to-many.
  - Assert `target: null` for the 404 relation.
  - Assert `collection.totalItems = {count: 25, isEstimated: false}`.
  - Assert statuses move pending → success.
  - Assert `entityItem === undefined` returns `{relations: [], isPending: true}`.
- [x] T008 Implement `useEntityItemRelationTargets(entityItem, options?)` in `NDATA/src/hooks/relation/use-entity-item-relation-targets.ts` per the contract:
  - Build the list from `entityItem.toOneRelations` + `toManyRelations`.
  - Resolve the target profile with `relation.profileRelation.getTargetProfile(profiles)`, where `profiles` comes from `useProfileEntities()`.
  - Run `useQueries` over `relation.fetchQuery(apiFetch, targetProfile)`, keeping the existing `toOneRelation.byUrl` / `toManyRelation.byUrl` keys.
  - Return the `RelationTargets` union from data-model.md §3, with `refetch` per entry.
  - Do not slice the to-many page.
  - Export from `NDATA/src/hooks/index.ts`.
- [x] T009 [P] Write the contract test `NDATA/src/hooks/relation/use-entity-item-to-many-relation-infinite.test.tsx`:
  - Two cursor pages.
  - `fetchNextPage` requests exactly the `next` href from page 1.
  - `hasNextPage` is false after page 2.
  - After a successful `useUnlinkRelation(relation).mutate(item)`, the infinite query refetches.
- [x] T010 Implement `useEntityItemToManyRelationInfinite(relation, options?)` in `NDATA/src/hooks/relation/use-entity-item-to-many-relation-infinite.ts`:
  - Wrap `EntityItemCollection.infiniteQuery(apiFetch, relation.link.href, targetProfile)`.
  - Override the key with `queryKeys.toManyRelation.infiniteByUrl(relation.name, relation.link.href)`.
  - `getNextPageParam: page => page.nextHref ?? undefined`.
  - Disabled while `relation` or the target profile is undefined.
  - Export from `NDATA/src/hooks/index.ts`.
- [x] T011 [P] Extend the delete contract test in `NDATA/src/hooks/item/use-delete-entity.test.tsx` (create it if absent): a cached to-many relation query and a to-one relation query that contain the deleted item are both refetched after `useDeleteEntityItem().mutate(item)` succeeds. The existing If-Match (`item.etag`) assertion must still hold.
- [x] T012 Change `useDeleteEntityItem` in `NDATA/src/hooks/item/use-delete-entity.ts`: on success, also call `invalidateQueries({queryKey: queryKeys.toOneRelation.all()})` and `invalidateQueries({queryKey: queryKeys.toManyRelation.all()})`. Leave the existing `removeQueries` / collection invalidation unchanged.
- [x] T013 [P] Create `createRelationDemoHandlers(baseUrl)` in `NDATA/test-fixtures/msw/relation-demo-handlers.ts`: a stateful in-memory model built with the existing handler factories in `NDATA/test-fixtures/msw/handlers.ts`.
  - Entities `customer`, `order`, `product`, `employee`, each with a profile served at `/profile/<plural>`.
  - Relations:
    - `customer.orders`: to-many; one customer has 25 orders and reports `total_items_estimate: 25`.
    - `order.customer`: to-one, required.
    - `order.products`: to-many, 3 items.
    - `employee.boss`: to-one, self-type.
    - `employee.colleague`: to-many, self-type; one employee is its own colleague, and one pair is linked by both `boss` and `colleague`.
  - `clear-*` / `delete` templates are present on some items and absent on others.
  - Clearing `order.customer` returns an `integrity/required-relation` problem (409).
  - Deleting a customer referenced by a required relation returns 409 `integrity/required-relation`.
  - The profile root lists all four entities.
  - Requires a Bearer token, like `demo-handlers.ts`.

### Pure graph core — `EG/util/` (data-model.md §1–§4), TDD

- [x] T014 [P] Write `EG/util/graph-ids.test.ts`, then implement `EG/util/graph-ids.ts`:
  - `graphNodeId(ref) = ref.id`
  - `overflowNodeId(owner, relationName) = \`overflow:${owner.id}:${relationName}\``
  - `graphEdgeId(sourceId, relationName, targetId) = \`${sourceId}->${relationName}->${targetId}\``
  - `expansionKey(ownerNodeId, relationName) = \`${ownerNodeId}::${relationName}\``
  - Every other file must compute ids only through these helpers.
- [x] T015 [P] Write `EG/util/entity-item-label.test.ts`, then implement `entityItemLabel(item, nameAttribute): string` in `EG/util/entity-item-label.ts`:
  - Use the formatted scalar value of `item.findAttribute(nameAttribute.name)` (strings as-is; numbers, booleans and dates via existing value formatting helpers if present in features, else `String()`).
  - Fall back to `item.id` when the attribute is missing or empty.
  - Truncation is not done here.
- [x] T016 [P] Write `EG/util/graph-state.test.ts` covering every transition and invariant in data-model.md §2.
  - Transitions: `explore` (append; re-exploring a trail item truncates to it), `returnTo`, `select`, `pin` (dedup by node id), `linkRemoved` (unpins; truncates the trail if the removed target was reached via that relation from that owner; clears a selection that points at the edge), `itemDeleted` (root → `rootDeleted = true`; focus → trail truncated so focus moves to the previous entry; unpins everywhere; clears selection).
  - Invariants: `trail.length ≥ 1`, `trail[0]` equals `root`, no two consecutive equal entries.
- [x] T017 Implement `graphReducer`, `initialGraphState(root, trailAfterRoot)` and the `GraphState` / `TrailEntry` / `GraphSelection` / `GraphItemRef` types in `EG/util/graph-state.ts`, exactly as in data-model.md §2 (depends on T014).
- [x] T018 [P] Write `EG/util/graph-search.test.ts`, then implement `graphSearchValidator(search): {trail: {e: string; id: string; via?: string}[]}` plus `trailToSearch` / `searchToTrail` in `EG/util/graph-search.ts`:
  - Keep only array entries with non-empty string `e` and `id` (and a string `via` if present).
  - Drop everything else and never throw.
  - Model it on `packages/features/src/search/entity-search-state.ts`.
- [x] T019 [P] Write `EG/util/build-graph-model.test.ts` with fixture `EntityItem`s built from `NDATA/test-fixtures/hal/fixtures.ts`. Cover:
  - (a) to-one set → 1 edge; to-one `null` → no node (FR-006).
  - (b) to-many with 4 targets → 4 nodes, no overflow.
  - (c) 25 targets, exact → 10 nodes + overflow `remaining 15, isEstimated false`.
  - (d) estimated 1250 → overflow `remaining 1240, isEstimated true`.
  - (e) `totalItems` absent but `hasNext` → overflow `remaining null`.
  - (f) two relations to the same item → one node, two edges (FR-002).
  - (g) self-relation → edge with `source === target`.
  - (h) trail root → B → C → C is `focus`, B is `previous-focus` and both are expanded; root is `trail` with only its `onTrail` edge to B (FR-015).
  - (i) budget: enough targets to exceed 50 → the previous focus collapses first; if the current focus alone exceeds 50, `perRelationCap` is lowered uniformly (min 1), overflow counts grow, and `truncated = true`; node count is always ≤ 50 (SC-002).
  - (j) pinned targets included, deduped, not double-subtracted from `remaining`, which never goes negative.
  - (k) `canRemove` = `canClear` for to-one and `canUnlinkItem` for to-many; `canDelete` from `item.canDelete`.
  - (l) an unreadable to-one target → node `unavailable: true`.
  - (m) `relationStatus` reports pending/error relations.
- [x] T020 Implement `buildGraphModel(input): GraphModel` in `EG/util/build-graph-model.ts`, with `GRAPH_TARGETS_PER_RELATION = 10` and `GRAPH_NODE_BUDGET = 50`, satisfying the rules in data-model.md §4 and the T019 tests (depends on T014, T015, T017).
- [x] T021 [P] Write `EG/util/to-knowledge-graph-props.test.ts`, then implement `toKnowledgeGraphProps(model, selection)` in `EG/util/to-knowledge-graph-props.ts`: map `GraphModel` → `{nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[], focusNodeId, trailNodeIds, selectedNodeId}` per data-model.md §5.
  - Overflow label: `"+ 15 more"`, or `"+ ~1 240 more"` when estimated (locale number formatting); `"+ more"` when `remaining` is null.
  - `ariaLabel` strings name the entity type, label and relation.
  - Output contains no accessor objects.

### ui pattern shell — `UIKG/` (contracts/ui-knowledge-graph-pattern.md)

- [x] T022 [P] Create `UIKG/knowledge-graph.types.ts` with `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `KnowledgeGraphMenuItem`, `KnowledgeGraphLabels` and `KnowledgeGraphProps`, exactly as in the contract (plain values only; no navigator-data import).
- [x] T023 [P] Write `UIKG/layout/radial-layout.test.ts`, then implement `radialLayout({nodes, edges, focusNodeId, trailNodeIds, previous?})` → `Record<id,{x,y}>` in `UIKG/layout/radial-layout.ts`, following research R3:
  - Focus at `(0,0)`.
  - Ring 1 holds the focus's direct neighbours, grouped by edge label in input order, with overflow last per group.
  - The previous focus's own neighbours sit on an outer arc behind it.
  - Trail-only nodes lie on a line continuing outward from the previous focus.
  - Same input → same output.
  - Surviving nodes reuse `previous` positions unless that would collide.
  - Test that 50 nodes produce no two positions closer than the node size.
- [x] T024 [P] Implement the `item` node in `UIKG/nodes/item-node.tsx`:
  - Icon badge via `resolveEntityIcon` + `color`, with fill `color-mix(in oklch, <color> 30%, transparent)`, default `var(--muted-foreground)`.
  - Label truncated with `Tooltip` for full text; sublabel.
  - Emphasis styles: focus thick border, previous-focus normal, trail dashed, selected ring; `muted` → reduced opacity.
  - Hidden `Handle`s; memoised.
- [x] T025 [P] Implement the `overflow` node in `UIKG/nodes/overflow-node.tsx`: a pill showing `label`, with sr-only "estimated" text when the label starts with `~` or `emphasis` says so. Memoised.
- [x] T026 [P] Implement the `relation` edge in `UIKG/edges/relation-edge.tsx`:
  - Straight path for a single edge.
  - Quadratic curve offset ±16px × sibling index for parallel edges on the same unordered pair (the sibling index is computed in `UIKG/edges/edge-siblings.ts` with its own test).
  - Cubic self-loop arc above the node when `source === target`.
  - Arrow marker at the target.
  - `EdgeLabelRenderer` label with classes `nodrag nopan` and `pointer-events: all`, truncated with a tooltip.
  - `status` loading/error glyph; `emphasis: "trail"` → thicker stroke.
- [x] T027 Implement `UIKG/knowledge-graph-menu.tsx`:
  - A Radix `Popover` anchored to a given DOM element.
  - Content: title, optional description, a `role="menu"` list of `KnowledgeGraphMenuItem` (`destructive` → destructive button variant; `disabled` respected), and an optional `footer` slot.
  - Closes on Escape or outside click and returns focus to the anchor.
- [x] T028 Implement `KnowledgeGraph` in `UIKG/knowledge-graph.tsx` (depends on T022–T027):
  - `ReactFlowProvider` + `ReactFlow` with `nodesDraggable={false}`, `nodesConnectable={false}`, `nodesFocusable`, `edgesFocusable`, and module-level stable `nodeTypes` / `edgeTypes`.
  - `colorMode` from `next-themes`; `Controls`; `fitView`; `minZoom 0.3`.
  - Positions from `radialLayout`, keeping previous positions in a ref; animated `fitView` when `focusNodeId` changes.
  - `onNodeClick` / `onEdgeClick` / `onPaneClick` → props, with Enter/Space on a focused node or edge firing the same callbacks.
  - `ariaLabelConfig` from `labels`; `role="application"` + an `aria-describedby` hint.
  - Render `nodeMenu` / `edgeMenu` through `KnowledgeGraphMenu`, anchored to the element with `data-id` equal to the menu's id.
- [x] T029 [P] Write the component test `UIKG/knowledge-graph.test.tsx` (jsdom + shims from T003):
  - Renders node and edge labels.
  - Clicking a node / edge label fires the callback with the id.
  - A `nodeMenu` prop renders menu items; selecting one calls `onSelect`.
  - Escape calls `onMenuOpenChange(false)` and focus returns to the node.
  - No `@contentgrid/navigator-data` import in `UIKG/` (assert via `import.meta.glob` or a lint rule).
- [x] T030 Export `KnowledgeGraph` and its prop types from `UIKG/index.ts` and `packages/ui/src/patterns/index.ts`. Do not export `radialLayout`.

### Shared feature utilities

- [x] T031 [P] Extract the merge logic of `useEntityDisplayPreferences` into a pure `resolveEntityDisplayPreferences(profileEntity, override, defaults)` in `packages/features/src/preferences/resolve-entity-display-preferences.ts`.
  - Merge order: user override > `useEntityDisplayDefaults()` > `profileEntity.getDefaultPreferences()`.
  - Returns `{preferences, nameAttribute, subtitleAttribute}`.
  - Refactor `use-entity-display-preferences.ts` to delegate, with no behaviour change.
  - Add a unit test and keep the existing tests green.
- [x] T032 Add `useEntityDisplayPreferencesResolver(): (profileEntity: ProfileEntity) => ResolvedEntityDisplay` in `packages/features/src/preferences/use-entity-display-preferences-resolver.ts`.
  - It subscribes once to the overrides store in `entity-display-preferences-store.ts`, so a colour change re-renders consumers.
  - Returns `{color?: string; icon: string; nameAttribute?: ProfileAttribute}` using T031.
  - Export from `packages/features/src/preferences/index.ts`.
  - Test: changing an override updates the resolved colour.
- [x] T033 [P] Create `useProfileEntityGate(entityName)` in `packages/features/src/util/use-profile-entity-gate.ts` (research R13, constitution VIII):
  - Returns `{status: "pending"|"error"|"not-found"|"ready", profileEntity?, element?}`.
  - `element` is the shared rendering: `LoadingPage`, or `ErrorPage` with `toProblemDisplayModel`, from `@contentgrid/features/app-info-pages`.
  - Built on `useProfileEntity`.
  - Add a test in `packages/features/src/util/use-profile-entity-gate.test.tsx`.
- [x] T034 [P] Extract the duplicated attributes+relations body from `packages/features/src/entity-item/entity-item-view.tsx` and `ContentFocusEntityItemBody` (in `packages/features/src/entity-item/variations/content-focus/views/entity-item-content-focus-view.tsx`) into `EntityItemDetailsBody({entityName, itemId, onRelationItemClick?, onMissingRelationTargetClick?, onBlindRelationOverwriteClick?, onRequiredRelationClick?})`.
  - New file: `packages/features/src/entity-item/components/entity-item-details-body.tsx`.
  - Renders `EntityItemAttributes` + `RelationToOneSection` / `RelationToManySection` per relation.
  - Switch both views to it and export it from `packages/features/src/entity-item/index.ts`.
  - Existing view tests must stay green.

**Checkpoint**: `pnpm test --project navigator-data --project ui --project features` is green; the foundation is ready.

---

## Phase 3: User Story 1 — See an item and its direct relations as a graph (P1) 🎯 MVP

**Goal**: Open `/$entity/$itemId/~graph` and see the root item, one named, directed edge per related target (to-one ≤1, to-many ≤10 + overflow count), and nodes in the user's colours.

**Independent Test**: Open `/customers/<id>/~graph` in mock mode on an item with at least one to-one and one to-many relation. Check the named edges, the related nodes, the overflow count, and colours matching preferences (quickstart scenarios 1–3).

- [x] T035 [P] [US1] Create `useGraphItems(state)` in `EG/hooks/use-graph-items.ts`:
  - For each trail entry and pinned ref, resolve its `ProfileEntity` by `entityName` via `useProfileEntities()`.
  - Load items with `useQueries` over `EntityItem.fetchByUrlQuery(apiFetch, profileEntity.itemUrl(ref.id), profileEntity)`.
  - Return `Map<nodeId, {item?: EntityItem; status; error}>`.
  - A 404/403 marks the entry `unavailable`, never retried.
- [x] T036 [US1] Implement `EntityGraphView` (render only) in `EG/views/entity-graph-view.tsx`, with the props from contracts/entity-graph-view.md:
  - Gate with `useProfileEntityGate(entityName)`.
  - Hold `useReducer(graphReducer, initialGraphState(...))`.
  - Load items with `useGraphItems`.
  - Call `useEntityItemRelationTargets` for the last two trail items only (two fixed hook calls, one per slot).
  - Resolve display with `useEntityDisplayPreferencesResolver`.
  - Build the props with `buildGraphModel` → `toKnowledgeGraphProps` and render `<KnowledgeGraph/>` inside `RightSidePanelLayout`.
  - The side panel initially shows `EntityItemDetailsBody` for the focus item.
  - Root not found / no access → `ErrorPage` via `toProblemDisplayModel`.
  - Root without relations → the root node plus a "This item has no relations" message.
- [x] T037 [P] [US1] Add per-relation loading/error indicators (FR-027) in `EG/views/entity-graph-view.tsx`: map `model.relationStatus` to edge `status` and to a small "Couldn't load <relation> — Retry" list above the graph that calls that entry's `refetch()`. Other relations keep rendering.
- [x] T038 [US1] Export `EntityGraphView` and `EntityGraphViewProps` from `EG/index.ts`; export `graphSearchValidator` from `EG/index.ts` for the routes.
- [x] T039 [P] [US1] Write the view test `EG/views/entity-graph-view.test.tsx` (MSW `createRelationDemoHandlers`, real `NavigatorDataProvider`):
  - The order root renders a `customer` edge and 3 `products` edges.
  - A customer with 25 orders renders 10 order nodes and an overflow reading `+ ~15 more`.
  - Node colour follows a store override.
  - A 404 root renders the not-found state.
  - A failing relation shows Retry and the other relations still render.
- [x] T040 [US1] Add route `apps/navigator/src/routes/_app/$entity/$itemId_.~graph.tsx` (URL `/$entity/$itemId/~graph`):
  - `validateSearch: graphSearchValidator`.
  - `loader` ensures the root profile + item, following `ensureEntityItemDetailLoaderData`.
  - `pendingComponent: LoadingPage`, plus `errorComponent` and `notFoundComponent`.
  - The component passes only `entityName`, `itemId`, `trail` and callbacks to `EntityGraphView`:
    - `onOpenItem` → navigate `/$entity/$itemId`
    - `onOpenCollection` → navigate `/$entity`
    - `onTrailChange` → `navigate({search: {trail}})`
  - Include the local `RelationProblemDialog`, as in `$itemId.tsx`.
  - Regenerate the route tree.
- [x] T041 [P] [US1] Mirror T040 in `apps/navigator-experimental/src/routes/_app/$entity/$itemId_.~graph.tsx`.
- [x] T042 [P] [US1] Register `createRelationDemoHandlers(baseUrl)` alongside the existing demo handlers in `apps/navigator/src/mocks/browser.ts` and `apps/navigator-experimental/src/mocks/browser.ts`.
- [x] T043 [P] [US1] Write the route test `apps/navigator/src/routes/_app/$entity/$itemId_.~graph.test.tsx`: valid params render the view; invalid `trail` search entries are dropped; the not-found root renders `notFoundComponent`.

**Checkpoint**: The MVP graph renders for any item via a direct URL.

---

## Phase 4: User Story 2 — Inspect an item's details next to the graph (P1)

**Goal**: One click on a node selects it, shows its details in the panel, and opens the node menu (View / Explore relations / Delete).

**Independent Test**: Click a non-focus node. The panel shows that item, the layout is unchanged, the menu shows View + Explore, and View opens the item page (quickstart 4–5).

- [x] T044 [P] [US2] Create `GraphDetailsPanel` in `EG/components/graph-details-panel.tsx`:
  - Props: `{entityName, itemId, onOpenItem, …relation problem callbacks}`.
  - Header shows the item label + entity type and an "Open item page" link-button calling `onOpenItem` (FR-011).
  - Body is `EntityItemDetailsBody`.
- [x] T045 [US2] Wire selection in `EG/views/entity-graph-view.tsx`:
  - `onNodeClick(itemNodeId)` → `select({kind: "node", ref})` and open `nodeMenu` for that node.
  - Selection `node` → panel renders `GraphDetailsPanel` for the ref; nothing selected → the focus item.
  - `selectedNodeId` is passed to `KnowledgeGraph`.
  - `onPaneClick` / menu close → `nodeMenu = null`, keeping the selection (FR-010, acceptance 2.6).
- [x] T046 [US2] Build the node menu items in `EG/views/entity-graph-view.tsx`:
  - "View" → `onOpenItem({entityName, itemId})`.
  - "Explore relations" → placeholder dispatch of `explore` (full behaviour in US3); omitted when the node is the focus.
  - "Delete" is added in US6.
  - Title = item label.
- [x] T047 [P] [US2] Extend `EG/views/entity-graph-view.test.tsx`:
  - Clicking a product node shows its attributes in the panel and the menu with View / Explore.
  - View calls `onOpenItem` with `{entityName: "product", itemId}`.
  - Escape closes the menu and the panel still shows the product.
  - Clicking another node switches the panel.

**Checkpoint**: US1 + US2 work.

---

## Phase 5: User Story 3 — Traverse to a related item while keeping context (P1)

**Goal**: Explore makes a node the focus. The last 2 focus items stay expanded, older ones collapse to trail-only, a breadcrumb trail allows return, the URL reflects the trail, and the budget stays ≤ 50.

**Independent Test**: root → explore B → explore C. The root is shown trail-only with its edge to B, the breadcrumb reads root › B › C, clicking root re-expands it, and reloading restores the view (quickstart 6–9).

- [x] T048 [P] [US3] Create `GraphTrailBreadcrumb` in `EG/components/graph-trail-breadcrumb.tsx`:
  - Uses ui `Breadcrumb`: one item per trail entry with its label (from `useGraphItems` results), plus the `via` relation title as a small separator caption.
  - The last item is the current page; earlier items are buttons calling `onReturn(index)`.
  - Wrapped in a `nav` landmark with an aria-label.
- [x] T049 [US3] Wire traversal in `EG/views/entity-graph-view.tsx`:
  - "Explore relations" dispatches `explore(ref, via)`, where `via` = the relation name of the edge from the current focus (first matching edge).
  - The breadcrumb dispatches `returnTo(i)`.
  - A `useEffect` on `state.trail` calls `onTrailChange(trail.slice(1))`.
  - A prop `trail` that differs from the state (browser back/forward) re-initialises it.
  - Pass `focusNodeId` / `trailNodeIds` to `KnowledgeGraph`.
- [x] T050 [US3] Handle unreadable trail entries (data-model §2): when `useGraphItems` reports a trail entry `unavailable`, truncate the trail before it and show a notice "Some items in this path are no longer available", in `EG/views/entity-graph-view.tsx`.
- [x] T051 [P] [US3] Extend `EG/views/entity-graph-view.test.tsx`:
  - Explore order → the customer is shown trail-only and the order's relations are expanded.
  - Explore a product next → only product + order are expanded.
  - The breadcrumb returns to the root and `onTrailChange` is called with `[]`.
  - Initial `trail` props restore the focus.
  - Re-exploring an existing node reuses it (no duplicate node ids in the rendered DOM).
- [x] T052 [P] [US3] Extend the route test `apps/navigator/src/routes/_app/$entity/$itemId_.~graph.test.tsx`: `onTrailChange` writes `?trail=` and a reload with that search restores the focus.

**Checkpoint**: All P1 stories are done; the MVP is traversable.

---

## Phase 6: User Story 4 — See and browse the rest of a large to-many relation (P2)

**Goal**: Clicking the overflow node opens a paged list of all targets in the panel. Rows can open details or be pinned into the graph.

**Independent Test**: On a customer with 25 orders: 10 nodes + overflow; click overflow → list with total "~25"; "Load more" pages; "Show in graph" adds the node, and the count drops by 1 (quickstart 10).

- [x] T053 [P] [US4] Create `OverflowRelationList` in `EG/components/overflow-relation-list.tsx`:
  - Props: `{ownerLabel, relation: EntityItemToManyRelation, visibleNodeIds: ReadonlySet<string>, onShowDetails(ref), onShowInGraph(ref), onBack()}`.
  - Uses `useEntityItemToManyRelationInfinite(relation)`.
  - Header: `<relation title> of <ownerLabel>` and the total from the first page's `totalItems`, prefixed `~` when `isEstimated` (FR-017).
  - Rows use `EntityItemReference`, with "Details" and "Show in graph" actions ("Show in graph" disabled when the node is already visible).
  - "Load more" while `hasNextPage` (FR-018); loading/error via `ProblemAlert` with retry.
  - A back button returns to item details.
- [x] T054 [US4] Wire overflow in `EG/views/entity-graph-view.tsx`:
  - `onNodeClick` on an overflow node → `select({kind: "overflow", owner, relation})` (no node menu).
  - The panel renders `OverflowRelationList` for that owner's `EntityItemToManyRelation` (found via `ownerItem.getToManyRelation(name)`).
  - "Show in graph" → `pin(owner, relation, ref)` (FR-019b).
  - "Details" → `select({kind: "node", ref})`.
  - `useGraphItems` loads pinned refs.
- [x] T055 [P] [US4] Extend `EG/views/entity-graph-view.test.tsx`:
  - The overflow click shows the list with 20 rows of the first page and the total.
  - "Load more" fetches the `next` href.
  - "Show in graph" on row 15 adds a node + `orders` edge and the overflow label drops by 1.
  - "Details" switches the panel to that order.

**Checkpoint**: US4 works on top of US1–US3.

---

## Phase 7: User Story 5 — Remove a relation link from the graph (P2)

**Goal**: Clicking an edge opens a menu naming the relation and both ends, with Select source / Select target and — only when permitted — Remove link. Remove link asks for confirmation, then clears the to-one relation or unlinks the single to-many target.

**Independent Test**: Click an order's `customer` edge → Remove link → confirm. The edge disappears and a toast appears. On an item without a clear template, no Remove link is offered (quickstart 11–13).

- [x] T056 [P] [US5] Create `RemoveLinkDialog` in `EG/components/remove-link-dialog.tsx`:
  - Controlled `AlertDialog` (`size="sm"`).
  - Title "Remove link?"; description names the relation title, source label and target label, and states that both items are kept (FR-022).
  - Destructive "Remove link" action with a pending state.
  - Props: `{relation: EntityItemToOneRelation | EntityItemToManyRelation, target?: EntityItem, sourceLabel, targetLabel, open, onOpenChange, onRemoved()}`.
  - Internally uses `useClearRelation(relation)` for to-one or `useUnlinkRelation(relation).mutate(target)` for to-many — never a hand-built request.
  - On error, render `<ProblemAlert model={toProblemDisplayModel(error)}/>` inside the dialog and keep it open (FR-024).
  - On success, call `onRemoved()` and `toast.success("Link removed")` from `sonner`.
- [x] T057 [US5] Wire the edge menu in `EG/views/entity-graph-view.tsx`:
  - `onEdgeClick(edgeId)` → `select({kind: "edge", edgeId})` and `edgeMenu = {title: relationTitle, description: "<source label> → <target label>", items}`.
  - Items: "Select <source label>", "Select <target label>" (→ node selection), and "Remove link" only when `edge.canRemove` (FR-021).
  - Overflow edges get the selection items only.
  - Remove link opens `RemoveLinkDialog`.
  - `onRemoved` → `linkRemoved(owner, relation, targetRef)`; the relation queries refetch via the existing hook invalidation (FR-023).
- [x] T058 [P] [US5] Extend `EG/views/entity-graph-view.test.tsx`:
  - An edge click shows the menu with the relation name and both labels.
  - Without a `clear` template → no Remove link.
  - Remove on to-one → PUT/DELETE per the template is sent, the edge disappears, and a toast appears.
  - Remove on to-many → DELETE to the unlink URL, the node disappears, and the overflow count adjusts.
  - A 409 `required-relation` → an alert in the dialog and the edge stays.
  - Cancel → no request.

**Checkpoint**: US5 works.

---

## Phase 8: User Story 6 — Delete an item from the graph (P2)

**Goal**: The node menu offers Delete when permitted. Confirming deletes the item; its node and edges disappear. Focus and root deletion are handled.

**Independent Test**: Product node → Delete → confirm. The node disappears and counts adjust. A blocked delete shows the required-relation alert. Deleting the focus steps back; deleting the root shows the deleted state (quickstart 14–16).

- [x] T059 [P] [US6] Create `DeleteItemDialog` in `EG/components/delete-item-dialog.tsx`:
  - Controlled `AlertDialog` (`size="sm"`).
  - Title "Delete <item label>?"; description names the entity type and states "This permanently deletes the item, not just the link" (FR-030).
  - Destructive action with a pending state.
  - Uses `useDeleteEntityItem()` (If-Match from `item.etag`, handled by the hook).
  - Error → `ProblemAlert` via `toProblemDisplayModel`, dialog stays open, graph unchanged (FR-032).
  - Success → `onDeleted()` + `toast.success("<label> deleted")`.
- [x] T060 [US6] In `EG/views/entity-graph-view.tsx`:
  - Add "Delete" (destructive) to the node menu only when the node's `canDelete` is true (FR-029); it opens `DeleteItemDialog`.
  - `onDeleted` → `itemDeleted(ref)` (FR-031).
  - If `state.rootDeleted`, render a "This item was deleted" empty state with a button calling `onOpenCollection(entityName)`.
- [x] T061 [P] [US6] Extend `EG/views/entity-graph-view.test.tsx`:
  - Delete is hidden without a `delete` template.
  - Deleting a product removes the node and its edges.
  - A 409 `required-relation` on a customer → an alert, the node stays.
  - Deleting the current focus → focus moves to the previous trail entry and `onTrailChange` is called.
  - Deleting the root → the deleted state; the button calls `onOpenCollection`.

**Checkpoint**: All P2 stories work.

---

## Phase 9: User Story 7 — Start the graph from any item (P3)

**Goal**: An "Open in graph" action on the item detail page; graph URLs survive reload and sharing.

**Independent Test**: Item page → Open in graph → the graph opens with that root; reload keeps root and trail (quickstart 1, 9).

- [x] T062 [US7] Add an optional `onOpenGraph?: () => void` prop to `EntityItemContentFocusView` in `packages/features/src/entity-item/variations/content-focus/views/entity-item-content-focus-view.tsx`. When set, append an "Open in graph" button (icon `Graph` from `@phosphor-icons/react`) to the toolbar actions passed to `BreadCrumbsToolBarLayout`. Default breadcrumbs stay unchanged. Add a test.
- [x] T063 [US7] Pass `onOpenGraph={() => navigate({to: "/$entity/$itemId/~graph", params: {entity, itemId}})}` in `apps/navigator/src/routes/_app/$entity/$itemId.tsx` and extend `$itemId.test.tsx` to assert the navigation.
- [x] T064 [P] [US7] Mirror T063 in `apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx`.

**Checkpoint**: All user stories are complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T065 [P] Create the relations outline for keyboard and assistive-technology users (FR-028) in `EG/components/graph-relations-outline.tsx`:
  - A collapsible `<section aria-label="Relations of <focus label>">` placed under the graph.
  - Content: a nested `<ul>` of relations → target buttons (select / explore / delete / remove-link via the same handlers as the menus) plus an overflow button.
  - Wire it into `EG/views/entity-graph-view.tsx`.
- [x] T066 [P] Pass Navigator wording to `KnowledgeGraph` `labels` (the `ariaLabelConfig` keys `node.a11yDescription.default`, `edge.a11yDescription.default`, `controls.*`) from `EG/views/entity-graph-view.tsx`. Verify that Tab → Enter on a node/edge opens its menu and Escape returns focus (extend `UIKG/knowledge-graph.test.tsx`).
- [x] T067 [P] Add stories to `UIKG/knowledge-graph.stories.tsx` (title `Patterns/KnowledgeGraph`): `Default`, `ParallelAndSelfLoop`, `Overflow` (exact + estimated), `TrailCollapsed`, `LoadingAndErrorEdges`, `Dark`.
- [x] T068 [P] Add `UIKG/knowledge-graph.interaction.stories.tsx` with a `WithInteraction` story tagged `no-visual-test`: `play()` clicks a node → the menu is visible (`within(document.body)`) → Escape → clicks an edge label → the edge menu is visible.
- [ ] T069 Generate Playwright visual baselines with `pnpm --filter storybook visual:update` on the pinned Linux image (ADR-009), then run `pnpm --filter storybook test:a11y` and fix violations.
- [x] T070 [P] Add the e2e spec `apps/navigator/tests/e2e/entity-graph.spec.ts` against mock mode, covering quickstart scenarios 1, 2, 4, 6, 8, 9, 10, 11 and 14.
- [x] T071 [P] Update docs:
  - Add the `knowledge-graph` pattern and its `@xyflow/react` dependency note to `packages/ui/CLAUDE.md`.
  - Add the `entity-graph` feature entry to `packages/features/CLAUDE.md`.
  - Document the `toManyRelation.infiniteByUrl` / `*.all()` keys and the new hooks in `packages/navigator-data/CLAUDE.md`, including the relation-key section that still mentions `forTargetEntity`.
- [x] T072 Verify the package boundaries:
  - `grep -rn "@xyflow\|radix-ui" packages/features apps` → no results.
  - `grep -rn "navigator-data" packages/ui/src/patterns/knowledge-graph` → no results.
  - `grep -rnE "href\s*\+|\\$\\{.*[Hh]ref\\}|\.split\(\"/\"\)" packages/features/src/entity-graph` → no results.
  - Then `pnpm typecheck && pnpm lint && pnpm test`.
- [x] T073 Run the full [quickstart.md](./quickstart.md) manual checklist (scenarios 1–19) in a browser against `pnpm --filter navigator dev` in mock mode, including dark mode and a <800px viewport. Record results, and any scenario that could not be exercised, in the PR description (constitution: browser verification).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. T001 must come before T002, T022–T030 and T003's shims being exercised.
- **Foundational (Phase 2)**: depends on Setup and blocks all user stories. Internal order:
  - T006 → T008, T010, T012.
  - Each contract test comes before its implementation (T007 → T008, T009 → T010, T011 → T012).
  - T014 → T017 → T020 → T021, with T015 also feeding T020.
  - T022 → T024–T028 → T029 → T030.
  - T031 → T032.
- **US1 (Phase 3)**: needs all of Phase 2.
- **US2**: needs US1 (T036).
- **US3**: needs US2 (the node menu from T046).
- **US4**: needs US1; independent of US2 and US3.
- **US5**: needs US1; independent of US2–US4.
- **US6**: needs US2 (node menu); independent of US3–US5.
- **US7**: needs US1 (route T040); independent of the others.
- **Polish**: after the desired stories. T065 needs US2–US6 handlers; T069 needs T067.

### Story completion order

US1 → US2 → US3 (MVP, all P1). After that, US4, US5, US6 and US7 can proceed in parallel. US6 needs only US2.

### Within each story

View tests (`[P]` test tasks) can be written alongside components. The view wiring task in each story edits `EG/views/entity-graph-view.tsx`, so view-wiring tasks from different stories must not run in parallel with each other.

## Parallel Opportunities

- **Phase 1**: T003, T004, T005 run in parallel after T001.
- **Phase 2**: three independent streams:
  - (a) navigator-data: T006–T013.
  - (b) pure util: T014–T021.
  - (c) ui pattern: T022–T030.
  - Plus (d) the shared feature utilities T031–T034.
  - Within stream (b): T014, T015, T016, T018 and T019 run in parallel. Within stream (c): T023–T026 run in parallel.
- **Stories**: component files for US4 (T053), US5 (T056) and US6 (T059) can be built in parallel once US1 lands.

## Parallel Example: Foundational

```bash
Task: "T007 contract test use-entity-item-relation-targets.test.tsx"
Task: "T014 graph-ids.ts + test"
Task: "T016 graph-state.test.ts"
Task: "T019 build-graph-model.test.ts"
Task: "T023 radial-layout.ts + test"
Task: "T024 item-node.tsx"
Task: "T031 resolve-entity-display-preferences.ts"
Task: "T034 entity-item-details-body.tsx extraction"
```

## Parallel Example: User Story 1

```bash
Task: "T035 EG/hooks/use-graph-items.ts"
Task: "T041 navigator-experimental ~graph route"
Task: "T042 register relation demo handlers in both apps"
Task: "T039 EG/views/entity-graph-view.test.tsx"
```

## Implementation Strategy

### MVP first

1. Phases 1–2 (setup + foundation). Stop and verify all unit and contract tests pass.
2. Phase 3 (US1). Stop and validate quickstart scenarios 1–3 in the browser. This is a demoable read-only graph.
3. Phases 4–5 (US2, US3) complete the P1 MVP: select, details and traversal.

### Incremental delivery

4. US4 (overflow browsing) → US5 (remove link) → US6 (delete): each is a separately reviewable PR with its own view-test extension.
5. US7 (entry point) can ship at any point after US1.
6. Polish: accessibility outline, stories/baselines, e2e, docs, boundary checks, full quickstart run.

## Notes

- [P] = different files and no dependency on an incomplete task.
- Commit after each task or logical group, and keep the lockfile change (T001) in its own commit for CODEOWNERS review.
- Do not change `canUnlinkItem` semantics or the `unlinkItemRequest` exception. The graph only consumes them.

---

## Implementation status (2026-10-01)

- **Done**: T001–T068, T070–T073. Full suite: 194 files / 2279 tests passing; `pnpm typecheck`,
  `pnpm lint`, `prettier --check` clean. Storybook `WithInteraction` (8/8 repeated runs) and axe
  (all 6 KnowledgeGraph stories) pass. e2e `apps/navigator/tests/e2e/entity-graph.spec.ts`: 6
  scenarios × chromium-large/-small, all passing against a mock-mode dev server.
- **Open — T069**: visual baselines for the 6 `Patterns/KnowledgeGraph` stories are NOT generated —
  ADR-009 requires the pinned Linux image (local runs already differ on 2 pre-existing baselines,
  `primitives-popover--simple` / `primitives-tooltip--on-text`, unrelated to this change).
- **Browser verification (T073)**, mock mode: quickstart 1, 2, 4–6, 8–11, 14 via e2e; 17 (parallel +
  self-loop edges) and dark mode via screenshot; 18 (Tab → node, Enter opens menu, Escape closes,
  focus returns) via scripted keyboard check; <800px stacked layout and 800px width checked.
  Not exercised in a browser: 3 (colour change round-trip — covered by unit tests), 7 retention
  depth beyond 3 levels, 12/13 (covered by view tests), 15/16 delete-blocked / root-delete
  (covered by view tests), 19 (per-relation error — covered by view tests).
- **Deviations / extra fixes found while implementing**:
  - `EntityItemDetailsBody` takes the resolved `entityItem` (a component), not `{entityName,itemId}`;
    the graph's `GraphDetailsPanel` resolves the item itself.
  - `useDeleteEntityItem` invalidates relation roots _without awaiting_ (awaiting stalled onSuccess
    for seconds while the deleted item's own relations retried their 404s).
  - Pre-existing bug fixed: `ProfileEntity.getDefaultPreferences()` crashed for a profile with no
    `id` attribute (the demo invoice profile) — mock mode crashed in the sidebar on every page.
  - `KnowledgeGraph` re-fits when the node set or canvas size changes (relation targets load after
    the first fit), and the graph view starts with the details panel collapsed between 800–1100px
    (the canvas is too narrow next to the app sidebar otherwise).
