# Implementation Plan: Entity Knowledge Graph

**Branch**: `graph-vis` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-entity-knowledge-graph/spec.md`; user direction:
"use the React Flow library for this".

## Summary

A traversable graph of entity items, opened from any item (`/$entity/$itemId/~graph`), drawn
with **React Flow (`@xyflow/react@12.11.6`)** next to a details panel. The focus item's relations
are drawn as named, directed edges; to-many relations show the first 10 targets plus an overflow
node with the remaining (exact or estimated) count that opens a paged list in the panel. Clicking
a node selects it (details in panel) and opens a node menu (View / Explore relations / Delete);
clicking an edge opens an edge menu (select ends / Remove link). Exploring keeps the last two focus
items expanded and collapses older ones to a trail, with a hard budget of 50 nodes.

Technical approach, per package:

- **`packages/ui`** — new plain-props pattern `patterns/knowledge-graph/`: the only consumer of
  `@xyflow/react`; custom item/overflow nodes, a `relation` edge (parallel offsets, self-loops,
  HTML labels), a deterministic hand-written radial layout, Radix popover menus. No HAL knowledge.
- **`packages/navigator-data`** — `useEntityItemRelationTargets` (fan-out over an item's
  relations, sharing existing relation query keys), `useEntityItemToManyRelationInfinite`
  (overflow list), `useDeleteEntityItem` additionally invalidates relation caches, and a
  relation-rich MSW demo model.
- **`packages/features`** — new `entity-graph/` feature: pure `util/` (graph state reducer,
  retention/budget model builder, label + id helpers, URL validator), `EntityGraphView`
  (orchestration), panel/overflow/dialog components; shared `useProfileEntityGate`,
  display-preference resolver, and an extracted `EntityItemDetailsBody`.
- **`apps/navigator` + `apps/navigator-experimental`** — `~graph` route (loader + pending/error/
  not-found components, search-param trail) and an "Open in graph" toolbar action on the item page.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2, Vite

**Primary Dependencies**:

- NEW `@xyflow/react@12.11.6` (exact pin, published 2026-09-01, ≥14 days old; MIT; no lifecycle
  scripts) in `packages/ui/package.json` `dependencies`. Brings `@xyflow/system@0.0.82`,
  `classcat`, `zustand@4.5.7` (private copy), `d3-drag/zoom/selection/interpolate@3`. `12.12.0`
  is too new (2026-09-24) and MUST NOT be used.
- Existing: TanStack Router/Query, `@contentgrid/navigator-data` accessors, `radix-ui`,
  `sonner`, `@phosphor-icons/react`, zustand 5 (preferences store).
- No layout library (see [research R3](./research.md#r3-layout-algorithm)).

**Storage**: N/A — in-memory state; trail in URL search params; colour preferences read from the
existing zustand preferences store.

**Testing**: Vitest (jsdom) + Testing Library + MSW contract tests; `mockReactFlow()` jsdom shims
(ResizeObserver, DOMMatrixReadOnly, offset sizes, getBBox); Storybook stories with Playwright
visual + a11y + `WithInteraction`; Playwright e2e in `apps/navigator/tests/e2e/`.

**Target Platform**: Evergreen desktop browsers; narrow screens stack the panel below the graph
(`RightSidePanelLayout` < 800px).

**Project Type**: pnpm monorepo web frontend (packages + two apps).

**Performance Goals**: SC-001 — graph for an item with ≤10 relations visible within 2 s (relation
reads run in parallel via `useQueries`); SC-005 — graph reflects a mutation ≤1 s after server
confirmation (local reducer update + invalidation); smooth pan/zoom at ≤50 nodes.

**Constraints**: Principles I (template/link-driven mutations, no URL building), III (React Flow and
Radix only in ui; features receive plain props), V (menu options gated on `canClear` /
`canUnlinkItem` / `canDelete`), VII (pinned dependency, reviewed lockfile), VIII (primitive app→view
props, loader-guaranteed data, transformation in `util/`). No hand-set page size — "first 10" is a
client-side slice of the server's first page.

**Scale/Scope**: ≤50 visible nodes; ≤10 targets per to-many relation; 2 expanded focus items;
7 user stories, 32 FRs; ~1 ui pattern, 2 new + 1 changed navigator-data hooks, 1 feature, 2 routes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle               | How the plan complies                                                                                                                                                                                                                                                                                                                                                          | Status                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| I. HAL only             | Remove link via `useClearRelation` / `useUnlinkRelation` (existing documented `unlinkItemRequest` exception, not extended); delete via `useDeleteEntityItem`. Overflow paging follows `nextHref`. Item fetch via `profileEntity.itemUrl(id)` in `useEntityItem`. IDs from `item.id`. No URL, cursor or page-size construction; trail search params hold identifiers, not URLs. | PASS                                                                                 |
| II. Model-first         | Relations from `entityItem.toOneRelations/toManyRelations`; target type via `ProfileRelation.getTargetProfile`; labels via preferred `nameAttribute` (profile defaults); relation names from `ProfileRelation.title`. Nothing hardcoded; demo model only in test fixtures.                                                                                                     | PASS                                                                                 |
| III. Package boundaries | `@xyflow/react` + Radix only in `packages/ui`; the pattern's props are strings/numbers/callbacks. features imports navigator-data (not Layer-1) and ui. `util/` stays pure (no JSX/hooks/ui).                                                                                                                                                                                  | PASS                                                                                 |
| IV. Stability           | `entity-graph/package.json` `x-stability: "stable"` (pre-GA exception); lint rule still applies.                                                                                                                                                                                                                                                                               | PASS                                                                                 |
| V. ABAC                 | Remove link shown iff `canClear` (to-one) / `canUnlinkItem` (to-many); Delete iff `canDelete`; hidden relations never appear (no `cg:relation` link). 403/404 rendered as outcomes, never retried. Update-after-mutation 403 shown via `ProblemAlert`.                                                                                                                         | PASS (note: `canUnlinkItem` is currently always true server-side — tracked, not new) |
| VI. Auth                | Uses existing `apiFetch` (Bearer header). Nothing new.                                                                                                                                                                                                                                                                                                                         | PASS                                                                                 |
| VII. Supply chain       | Exact pin `12.11.6`, ≥14 days old, no build scripts, `onlyBuiltDependencies` unchanged, lockfile change via reviewed PR.                                                                                                                                                                                                                                                       | PASS                                                                                 |
| VIII. View/app contract | App passes `entityName`, `itemId`, `trail`, callbacks; route `loader` + `pendingComponent/errorComponent/notFoundComponent`; view gates via shared `useProfileEntityGate` in `packages/features/src/util/`; retention/budget/labels/URL validation in `entity-graph/util/`.                                                                                                    | PASS (see Complexity: gate hook vs. unmerged ADR-018)                                |
| Error handling          | All failures → `toProblemDisplayModel` → `ProblemAlert` (dialogs/menus); `requiredRelation`/`blindRelationOverwrite`/`unsatisfiedVersion` get their kind-specific alerts; errors typed `Error`.                                                                                                                                                                                | PASS                                                                                 |
| Dev workflow            | New/changed hooks ship MSW contract tests + fixtures; pattern has stories + visual baselines; e2e + manual browser run per [quickstart](./quickstart.md).                                                                                                                                                                                                                      | PASS                                                                                 |

**Post-design re-check (after Phase 1)**: PASS. The design introduces no new hand-built request,
no Layer-1 import outside navigator-data, and no domain type in ui props
([contracts/ui-knowledge-graph-pattern.md](./contracts/ui-knowledge-graph-pattern.md)).

## Project Structure

### Documentation (this feature)

```text
specs/007-entity-knowledge-graph/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R16
├── data-model.md        # Phase 1 — state, graph model, ui prop types
├── quickstart.md        # Phase 1 — validation guide
├── contracts/
│   ├── ui-knowledge-graph-pattern.md
│   ├── navigator-data-hooks.md
│   └── entity-graph-view.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/ui/
├── package.json                                   # + "@xyflow/react": "12.11.6"
├── src/styles/preset.css                          # + @import "@xyflow/react/dist/base.css" layer(base); --xy-* → tokens
└── src/patterns/knowledge-graph/                  # NEW
    ├── index.ts
    ├── knowledge-graph.tsx                        # ReactFlow wrapper, menus, a11y config
    ├── nodes/{item-node,overflow-node}.tsx
    ├── edges/relation-edge.tsx                    # parallel offset, self-loop, label
    ├── layout/radial-layout.ts (+ .test.ts)
    ├── knowledge-graph-menu.tsx                   # Popover + role=menu items
    ├── knowledge-graph.types.ts
    ├── knowledge-graph.test.tsx
    ├── knowledge-graph.stories.tsx
    └── knowledge-graph.interaction.stories.tsx
packages/ui/src/index.ts                           # export pattern
packages/ui/test-setup(.ts)                        # + mockReactFlow shims

packages/navigator-data/
├── src/query-keys.ts                              # + toManyRelation.infiniteByUrl, toOne/toManyRelation.all
├── src/hooks/relation/use-entity-item-relation-targets.ts (+ .test.tsx)          # NEW
├── src/hooks/relation/use-entity-item-to-many-relation-infinite.ts (+ .test.tsx) # NEW
├── src/hooks/item/use-delete-entity.ts (+ test)   # CHANGED: invalidate relation roots
├── src/hooks/index.ts                             # exports
└── test-fixtures/msw/relation-demo-handlers.ts    # NEW demo model

packages/features/
├── package.json                                   # + "./entity-graph" export
├── test-setup.ts                                  # + mockReactFlow shims
├── src/util/use-profile-entity-gate.ts (+ test)   # NEW shared gate (R13)
├── src/preferences/resolve-entity-display-preferences.ts (+ test)  # NEW; hook delegates
├── src/preferences/use-entity-display-preferences-resolver.ts      # NEW
├── src/entity-item/components/entity-item-details-body.tsx         # NEW (extracted)
├── src/entity-item/entity-item-view.tsx                            # uses details body
├── src/entity-item/variations/content-focus/views/entity-item-content-focus-view.tsx  # details body + onOpenGraph
└── src/entity-graph/                              # NEW feature (see contracts/entity-graph-view.md)
    ├── package.json  index.ts
    ├── views/entity-graph-view.tsx (+ test)
    ├── hooks/use-graph-items.ts
    ├── components/…
    └── util/{graph-ids,graph-state,build-graph-model,to-knowledge-graph-props,entity-item-label,graph-search}.ts (+ tests)

apps/navigator/src/routes/_app/$entity/$itemId_.~graph.tsx (+ test)   # NEW
apps/navigator/src/routes/_app/$entity/$itemId.tsx                     # onOpenGraph
apps/navigator/src/mocks/browser.ts                                    # + relation demo handlers
apps/navigator/tests/e2e/entity-graph.spec.ts                          # NEW
apps/navigator-experimental/src/routes/_app/$entity/$itemId_.~graph.tsx  # NEW (mirror)
apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx          # onOpenGraph
apps/navigator-experimental/src/mocks/browser.ts                         # + relation demo handlers
apps/storybook/tests/__snapshots__/…knowledge-graph…png                  # baselines
```

**Structure Decision**: Existing monorepo layout; React Flow is isolated in a ui pattern (PDF-viewer
precedent), data fan-out in navigator-data, orchestration + pure transformation in a new
`entity-graph` feature, thin routes in both apps.

## Complexity Tracking

| Item                                                                                                                                       | Why needed                                                               | Simpler alternative rejected because                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| New shared `useProfileEntityGate` in `packages/features/src/util/` while unmerged ADR-018 (branch `ACC-3184-spec-001`) argues for inlining | Constitution VIII (binding for plans) requires one shared gate primitive | Inlining contradicts the ratified constitution; if ADR-018 merges first, swap to inline in one file |
| New dependency `@xyflow/react` (+ private zustand 4 copy)                                                                                  | User requirement; pan/zoom, focusable nodes/edges, HTML edge labels      | Hand-written SVG graph reimplements viewport + a11y; canvas libraries can't host shadcn popovers    |
| Client-side slice to 10 instead of a server page size                                                                                      | Search template has no size property; URL building is prohibited (I)     | Hand-adding `?size=10` violates Principle I                                                         |
| `useDeleteEntityItem` invalidates all relation caches (broad)                                                                              | Any relation may list the deleted item; ids alone can't target keys      | Targeted invalidation would require knowing every referencing relation client-side                  |

## Implementation Sequence (input for `/speckit-tasks`)

1. **Dependency**: add `@xyflow/react@12.11.6` to `packages/ui`; verify no build scripts, lockfile
   diff reviewed; import `base.css` in `preset.css`; map `--xy-*` variables.
2. **navigator-data**: query-key additions → `useEntityItemRelationTargets` →
   `useEntityItemToManyRelationInfinite` → `useDeleteEntityItem` invalidation, each with MSW
   contract tests; `createRelationDemoHandlers` fixture.
3. **ui pattern** (can run parallel to 2): `radialLayout` + tests → nodes/edge → `KnowledgeGraph`
   with menus + a11y → jsdom shims + component test → stories + visual baselines.
4. **features shared**: `resolveEntityDisplayPreferences` + resolver hook; `useProfileEntityGate`;
   extract `EntityItemDetailsBody` (refactor both detail views, tests green).
5. **entity-graph util** (TDD): ids → graph state reducer + search validator → `buildGraphModel`
   (retention, cap 10, overflow counts, dedup, budget 50) → `toKnowledgeGraphProps` → label util.
6. **entity-graph view** — per user story: US1 (render graph) → US2 (select + panel + node menu
   View) → US3 (explore/trail/breadcrumb) → US4 (overflow list + pin) → US5 (remove link) → US6
   (delete) → relations outline (FR-028) and per-relation error/retry (FR-027).
7. **apps**: `~graph` route with loader/pending/error/not-found and search validation in both
   apps; "Open in graph" action (US7); mock-mode demo handlers; route tests.
8. **Validation**: e2e spec; full quickstart manual run in a browser (constitution workflow rule);
   update `packages/features/CLAUDE.md` / ui pattern docs for the new pattern.
