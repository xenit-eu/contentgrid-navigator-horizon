# Research: Entity Knowledge Graph

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-30

Each entry: Decision / Rationale / Alternatives considered.

## R1. Graph rendering library

- **Decision**: `@xyflow/react` (React Flow) pinned at **`12.11.6`** (published 2026-09-01).
  Transitive: `@xyflow/system@0.0.82`, `classcat ^5.0.3`, `zustand ^4.4.0` (resolves 4.5.7, a
  private copy next to our zustand 5.0.14), `d3-drag`/`d3-zoom`/`d3-selection`/`d3-interpolate`
  `^3`.
- **Rationale**: Requested by the user. MIT; peer deps `react >=17` (React 19 OK); **no
  install/postinstall/prepare scripts** in either package, so `onlyBuiltDependencies: []` stays
  empty. ~50–60 KB gzip. Custom node/edge types + `EdgeLabelRenderer` give full control over
  HTML labels and popover anchors; built-in keyboard focus for nodes/edges.
- **Supply chain**: `12.12.0` (2026-09-24) is inside the 14-day `minimumReleaseAge` window and
  MUST NOT be used. The install touches `pnpm-lock.yaml` (CODEOWNERS-protected) → reviewed PR.
- **Alternatives**: Cytoscape.js (canvas, no React-native nodes → can't host shadcn popovers
  inside nodes); vis-network (canvas, weaker a11y); hand-written SVG (reimplements pan/zoom/fit).

## R2. Where React Flow lives (package boundary)

- **Decision**: `@xyflow/react` is a dependency of **`packages/ui`** only, wrapped by a new
  generic pattern `packages/ui/src/patterns/knowledge-graph/` that takes plain props
  (node/edge view models with string ids, labels, colour strings, icon names, callbacks).
  `packages/features` never imports `@xyflow/react`.
- **Rationale**: Same precedent as the PDF viewer (`@embedpdf/*` lives in ui behind a
  plain-props pattern). Keeps the rendering library swappable and keeps HAL knowledge out of ui
  (Principle III). Popovers/menus use Radix, which is only allowed inside ui — the pattern renders
  menu _shells_ whose items are passed in as plain `{ id, label, destructive?, onSelect }`.
- **Alternatives**: dependency in `packages/features` — rejected: features would then render
  Radix-backed popovers anchored inside React Flow nodes, and a second consumer (e.g. a future
  Console model diagram) could not reuse it.

## R3. Layout algorithm

- **Decision**: Hand-written deterministic **radial layout**, no dependency, as a pure function
  in the ui pattern (`layout/radial-layout.ts`):
  - Current focus at the centre; its targets on ring 1, grouped by relation (relations sorted in
    profile order, targets in server order), overflow node last in each group's arc.
  - Previous focus (the second expanded item) sits on ring 1 on the side it was reached from; its
    own targets fan out on an outer arc behind it (ring 2), away from the centre.
  - Collapsed (trail-only) items are placed on a "trail line" continuing outward from the previous
    focus, one step per older item.
  - Stability: positions are keyed by node id; a node that stays visible keeps its previous
    position unless it collides; React Flow animates the remainder (CSS transition on transform).
- **Rationale**: ≤50 nodes; deterministic output is unit-testable in jsdom; the focus+trail shape
  maps directly onto FR-013/FR-015. d3-hierarchy would require first reducing the graph to a
  spanning tree anyway; d3-force is non-deterministic and needs tick management; dagre is
  layered and re-lays everything (nodes jump); elkjs is 433 KB gzip and EPL/GPL-licensed.
- **Escape hatch**: if the radial look proves too rigid, add `d3-force@3.0.0` seeded from the
  radial positions with a fixed synchronous tick count — no change to the pattern's props.

## R4. Parallel edges and self-loops

- **Decision**: One custom edge type `relation` in the pattern. It computes the edge's index among
  siblings sharing the same unordered node pair and bends a quadratic curve by a perpendicular
  offset (`±16px × index`). Self-loops (source === target) render a cubic arc above the node.
  Labels via `EdgeLabelRenderer` (HTML, `nodrag nopan`, `pointer-events: all`), truncated with
  full text in a tooltip.
- **Rationale**: neither is built in; this is the documented React Flow approach
  (custom-edges example `SelfConnectingEdge`).

## R5. Node identity

- **Decision**: Graph node id = `entityItem.id` (spec FR-002; the user stated ids are unique
  across entity types — ContentGrid ids are UUIDs). Each node also carries its `entityName`, which
  together with the id is what the feature uses to fetch it (`profileEntity.itemUrl(id)` via
  `useEntityItem({ profileEntity, entityId })`).
- **Rationale**: matches the spec; never parses ids out of hrefs (Principle I).
- **Risk noted**: navigator-data caches are keyed by URL, not id. If a collision across types were
  ever observed, the node key can switch to `${entityName}:${id}` in one util function
  (`graphNodeId`) without other changes — all code goes through that helper.

## R6. Fetching relations of an expanded item

- **Decision**: New navigator-data hook **`useEntityItemRelationTargets(entityItem)`** that fans out
  with `useQueries` over `item.toOneRelations` / `item.toManyRelations`, using the existing
  `relation.fetchQuery(apiFetch, targetProfile)` factories (same query keys as the existing
  single-relation hooks, so the detail panel and the graph share cache and mutation
  invalidation). Returns one entry per relation: `{ relation, targetProfile, status, error,
refetch, target (to-one) | collection (to-many) }`.
- **"First 10"**: the search template exposes no page-size property and URLs must not be
  hand-built, so the first page is fetched at the server's default size and the feature util
  slices to 10 (`GRAPH_TARGETS_PER_RELATION = 10`). Remaining count =
  `collection.totalItems.count − shown`, with `isEstimated` passed through. If `totalItems` is
  absent but `hasNext`, the overflow node shows "more" without a number.
- **Alternatives**: calling `useEntityItemToManyRelation` per relation from N child components —
  rejected because the util that builds the graph model needs all results in one place to apply the
  node budget (FR-015).

## R7. Overflow list paging

- **Decision**: New navigator-data hook **`useEntityItemToManyRelationInfinite(relation)`**,
  wrapping `EntityItemCollection.infiniteQuery` but keyed under
  `queryKeys.toManyRelation.infiniteByUrl(relation.name, url)` (new key, child of
  `toManyRelation.forRelationName`) so existing unlink/clear invalidation also refreshes it.
  Pages follow `nextHref` only.
- **Rationale**: FR-018 "load further pages until all listed"; the generic
  `useEntityItemCollectionInfiniteScroll` is keyed under `entityItemCollection` and would not be
  invalidated by relation mutations.

## R8. Mutations & permission gating

- **Remove link, to-one**: `useClearRelation(relation)`; offered iff `relation.canClear`.
- **Remove link, to-many (one target)**: `useUnlinkRelation(relation).mutate(targetItem)`; offered
  iff `relation.canUnlinkItem`. This reuses the single documented hand-built-request exception
  (`unlinkItemRequest`) — no new exception is introduced. Note: `canUnlinkItem` is currently
  always `true` (no server template yet), so SC-006 is met to the extent the server exposes the
  signal; a 403 is rendered as an authorization outcome via `ProblemAlert`.
- **Delete item**: `useDeleteEntityItem()`; offered iff `entityItem.canDelete`. It sends If-Match
  from `item.etag`. **Change**: on success it must also invalidate `toOneRelation` and
  `toManyRelation` roots (today it only invalidates `entityItem`/`entityItemCollection`), so every
  relation that listed the deleted item refetches — required for FR-031 and useful for the
  existing detail view too. Covered by an updated contract test.
- **If-Match on relation mutations**: follows current code (ACC-3186 stopgap: set/add/clear send
  none; unlink sends the source item's etag). The graph does not add its own ETag handling. A 412
  is surfaced (`VersionConflictAlert`) with "refresh" = refetch the source item; never
  auto-retried.
- **Errors**: every failure → `toProblemDisplayModel` → `ProblemAlert` inside the open menu /
  dialog; `requiredRelation` (409) and `blindRelationOverwrite` get their dedicated alerts.
  Success → `toast.success` (sonner, as in `create-entity-item-container.tsx`).

## R9. Display name as a string

- **Decision**: New pure util `entityItemLabel(item, nameAttribute)` in the feature `util/`,
  returning a plain string (formatted scalar value of the preferred name attribute, fallback
  `item.id`). Colour/icon from `useEntityDisplayPreferences(profileEntity)` (colour is a raw CSS
  colour string, e.g. `oklch(...)`, fallback `var(--muted-foreground)` like `IconBadge`).
- **Rationale**: node labels must be strings (a11y labels, truncation, tooltips);
  `EntityItemReference` returns a ReactNode. Because preferences are per profile and the graph can
  contain many entity types (and hooks can't be called in a loop), extract the merge into a pure
  `resolveEntityDisplayPreferences(profileEntity, override)` in
  `packages/features/src/preferences/`, have `useEntityDisplayPreferences` delegate to it, and add
  `useEntityDisplayPreferencesResolver()` which subscribes to the overrides store once and returns
  `(profileEntity) => ResolvedDisplay` — so colour changes re-render the graph (spec edge case).
- **Alternatives**: one hidden resolver component per distinct profile reporting into a map —
  rejected as indirect and render-order dependent.

## R10. Graph state & retention rule

- **Decision**: Graph navigation state is a pure reducer in the feature `util/`
  (`graph-state.ts`): `{ root, trail[], pinned: Record<expansionKey, nodeRef[]>, selected }`, with
  actions `explore`, `returnTo`, `select`, `pin`, `removed`, `deleted`. A second pure function
  `buildGraphModel(state, expansions, displayResolver)` produces the visible nodes/edges applying:
  last-2 focus items expanded, older trail-only, ≤10 targets per to-many relation + one overflow
  node, dedupe by node id, pinned targets included, **budget 50** (collapse previous focus first;
  current focus never collapses — worst case 1 + relations×11 is capped by trimming the previous
  focus, and if the current focus alone exceeds 50 the per-relation cap is reduced to keep ≤50,
  overflow counts adjusting accordingly).
- **Rationale**: Principle VIII (transformation logic in util, testable without DOM); SC-002 is
  directly unit-testable.

## R11. URL state

- **Decision**: Route `/$entity/$itemId/~graph` (TanStack non-nested file
  `_app/$entity/$itemId_.~graph.tsx`, mirroring the `~create` convention). Search params:
  `trail` — array of `"<entityName>/<id>"`-style opaque pairs encoded as a JSON array of
  `{ e, id, via? }` objects (TanStack Router's default JSON search serialisation), validated by a
  hand-written validator like `entitySearchStateValidator`. Root = path params; focus = last trail
  entry. Selection is not persisted.
- **Rationale**: FR-026 reload/share. Values are identifiers, not URLs — no URL construction.

## R12. Details panel

- **Decision**: `RightSidePanelLayout` (existing, 1fr/360px, collapsible, stacks <800px) hosts the
  graph (main) and details (side). Extract the duplicated attributes+relations body
  (`entity-item-view.tsx` / `ContentFocusEntityItemBody`) into an exported
  `EntityItemDetailsBody({ entityName, itemId, onRelationItemClick, …problem callbacks })` in
  `entity-item/components/` and reuse it in the panel. The overflow list replaces the panel
  content while open (with a back button to the selected item's details).
- **Alternatives**: a resizable split — no `resizable` primitive exists; out of scope.

## R13. Gate primitive (constitution vs. ADR-018)

- **Finding**: Constitution VIII requires a shared gate primitive (e.g. `useProfileEntityGate` in
  `packages/features/src/util/`); unmerged ADR-018 (branch `ACC-3184-spec-001`) argues for inlining.
  Neither exists on main.
- **Decision**: Follow the constitution (it is the binding gate for plans): add
  `packages/features/src/util/use-profile-entity-gate.ts` returning
  `{ status: "pending" | "error" | "not-found" | "ready", profileEntity?, element? }` with the
  shared `LoadingPage`/`ErrorPage` rendering, used by the graph view. If ADR-018 merges first with
  the opposite rule, the view inlines the branch instead — a one-file change.

## R14. Testing React Flow in jsdom

- **Decision**: Pure logic (layout, graph state, model building, labels) gets plain Vitest unit
  tests. Pattern/feature component tests use a `mockReactFlow()` helper (ResizeObserver,
  `DOMMatrixReadOnly`, `offsetWidth/Height`, `SVGElement.getBBox`, per the React Flow testing guide)
  added to `packages/ui/test-setup` and `packages/features/test-setup.ts`, with
  `nodesDraggable={false}`. Canvas interactions (click node/edge → menus) are covered by a
  Storybook `WithInteraction` story and a Playwright e2e spec against a relation-rich MSW demo
  model; visual baseline per ADR-009.

## R15. Demo/mock data

- **Finding**: `createDemoHandlers` only serves `invoice` with no relations.
- **Decision**: Add `createRelationDemoHandlers(baseUrl)` in
  `packages/navigator-data/test-fixtures/msw/` serving a small stateful model built from the
  existing `halforms/*.json` fixtures shape — `customer` ↔ `orders` (to-many, 25 items with
  `total_items_estimate` on one customer), `order` → `customer` (to-one), `order` → `products`
  (to-many, 3), `employee` → `boss` (to-one, self-type) / `colleague` (to-many, self-type), one item
  related to itself; with `set-/clear-/delete` templates on some items and absent on others (ABAC
  gating). Wired into both apps' mock mode next to the existing demo handlers.

## R16. Accessibility (FR-028)

- **Decision**: React Flow keyboard a11y on (`nodesFocusable`, `edgesFocusable`,
  `ariaLabelConfig` with Navigator wording; Enter on a focused node/edge opens its menu). Plus a
  visually-compact, screen-reader-first **relations outline** (a `<ul>` of the focus item's
  relations → targets → "N more" buttons) rendered in the panel header area / collapsible under
  the graph, exposing every action. The trail is a `Breadcrumb` (nav landmark).
