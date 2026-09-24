# Implementation Plan: Advanced Single Search Bar with Autocomplete

**Branch**: `003-single-search-autocomplete` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-single-search-autocomplete/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A single search input, shown above an entity's record list, that suggests values from every prefix/full-text-searchable attribute (direct or relation-traversal) as the user types, plus up to 5 directly-navigable matching records — coexisting with, not replacing, the existing multi-field Filters dialog. Since no server-side capability exists to match a term against multiple attributes in one request (research D1), the technical approach fans out one request per contributing attribute via a new `useEntitySearchSuggestions` hook (mirroring the existing `useQueries`-based `useProfileEntities` pattern) and merges/caps/dedupes the results client-side through pure, independently-tested functions. The feature ships at `"x-stability": "experimental"` in a new `packages/features/src/entity-search-bar/` directory, reachable only from `apps/navigator-experimental`, composing with the existing `EntityItemCollectionView` through its current public props rather than modifying that stable component.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (existing repo stack — no change)

**Primary Dependencies**: `@contentgrid/navigator-data` (new hook), `@contentgrid/ui` (new pattern component, built on existing `Popover`/`Input` primitives — no new package dependency), `@tanstack/react-query` (`useQueries`, existing), `@tanstack/react-router` (existing URL-state pattern)

**Storage**: N/A — no new persisted data; reads exclusively through the existing ContentGrid HAL API via existing accessor/request mechanisms

**Testing**: Vitest (`--project features`, `--project navigator-data`, `--project ui`), MSW-backed HAL contract tests for the new hook (per Constitution's Development Workflow rule), Playwright story snapshots for the new `packages/ui` pattern (per ADR-009), manual dev-server validation per [quickstart.md](./quickstart.md)

**Target Platform**: Web (existing Vite/React SPA), reachable only via `apps/navigator-experimental` (internal, auth-gated preview — never a public URL)

**Project Type**: Web application feature (pnpm monorepo — `packages/navigator-data` + `packages/features` + `packages/ui` + `apps/navigator-experimental`)

**Performance Goals**: SC-002 (suggestions within 500ms of typing pause for 95% of searches), SC-006 (no perceptible delay for client-side enum filtering) — see research D1/D4 for how the fan-out request strategy is expected to stay within this given existing debounce/minLength gating

**Constraints**: No new npm dependency (research D10 — reuses existing `Popover`/`Input` primitives, no supply-chain review needed); no change to any already-`stable` feature's public contract (research D3/D7); relation-traversal effective matches must never be a different entity type (FR-024, satisfied structurally per research D2)

**Scale/Scope**: Bounded by the spec's own caps — 20 total search-term suggestions, 5 effective matches, one fan-out request per contributing searchable attribute (typically a handful per entity, not unbounded)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                                                   | Status           | Notes                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. HAL Is the Only Interaction Model                                        | PASS             | All requests driven by `searchEntityRequest`/existing template values; no hand-built URLs; no new mutations (read-only feature)                                                                                                                                                       |
| II. Model-First — No Hardcoded Domain Knowledge                             | PASS             | Contributing attributes discovered at runtime from `profileEntity.searchTemplate.searchProperties`; no hardcoded attribute names                                                                                                                                                      |
| III. Two-Layer Dependency Model & Package Boundaries                        | PASS             | New hook in `navigator-data`; new pattern in `ui` takes plain scalar/array props only (no `HalFormsField`/`SearchHalFormTemplateProperty` crossing into `ui`, contracts §6); new feature imports `@contentgrid/navigator-data` only, never a Layer-1 package directly                 |
| IV. Three-Track Delivery & Stability Gating                                 | PASS             | New feature starts `"experimental"` (research D3); only `apps/navigator-experimental` imports it; does not touch any existing `stable` feature's directory or public contract                                                                                                         |
| V. Deny-by-Default ABAC                                                     | PASS             | Every suggestion/effective-match request goes through the existing, already-ABAC-filtered collection/search endpoints (FR-017) — no new permission surface                                                                                                                            |
| VI. Authentication, Token Handling & Webhook Verification                   | PASS (unchanged) | Reuses existing `apiFetch`/Bearer-token flow; no new auth surface                                                                                                                                                                                                                     |
| VII. Supply-Chain Integrity for Dependencies                                | PASS             | No new package dependency introduced (research D10)                                                                                                                                                                                                                                   |
| VIII. View-Owned Data Loading, App-View Contract & Transformation Placement | PASS             | Data fetching lives in the new `navigator-data` hook; budget/selection/date-shortcut transformation logic lives in the new feature's own `util/` (research D5/D6/D7/D8); the view composes `EntityItemCollectionView` via its existing props rather than duplicating its data loading |

No violations — Complexity Tracking table intentionally omitted (only required when a violation needs justification).

## Project Structure

### Documentation (this feature)

```text
specs/003-single-search-autocomplete/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── hooks-and-components.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/navigator-data/src/hooks/collection/
├── use-entity-search-suggestions.ts       # NEW: fans out per-attribute typeahead + effective-match queries (contracts §1)
└── use-entity-search-suggestions.test.ts  # NEW: MSW-backed HAL contract test

packages/features/src/entity-search-bar/   # NEW feature directory
├── package.json                           # { "x-stability": "experimental" }
├── index.ts                                # public API barrel
├── entity-search-bar.tsx                   # view: calls useEntitySearchSuggestions, composes with EntityItemCollectionView
├── entity-search-bar.test.tsx
└── util/
    ├── suggestion-budget.ts                # applySuggestionBudget (contracts §2, FR-025/026)
    ├── suggestion-budget.test.ts
    ├── effective-match-selection.ts        # selectEffectiveMatches (contracts §3, FR-007/008/024/028)
    ├── effective-match-selection.test.ts
    ├── date-range-shortcut.ts              # relative-preset → after/before encoding (FR-021-023)
    ├── date-range-shortcut.test.ts
    ├── enum-quick-filter.ts                # filterEnumOptions (contracts §4, FR-019)
    └── enum-quick-filter.test.ts

packages/ui/src/patterns/
├── search-suggestions-popover.tsx          # NEW presentational pattern (contracts §6)
├── search-suggestions-popover.test.tsx
└── search-suggestions-popover.stories.tsx  # Playwright story snapshot (ADR-009)

packages/features/src/search/
├── search-term-url-state.ts                # NEW: decode/applySearchTermToSearchState, "q" key (contracts §5)
├── search-term-url-state.test.ts
└── index.ts                                # MODIFIED: export the two new functions

apps/navigator-experimental/src/routes/_app/$entity/
└── index.tsx                               # MODIFIED: wire "q" URL state, render entity-search-bar alongside EntityItemCollectionSearchView
```

**Structure Decision**: New capability lands in three existing packages plus one new feature directory — never inside an already-`stable` feature (research D3). `navigator-data` gets one new hook (data layer). `packages/features/src/entity-search-bar/` (new, `experimental`) owns orchestration and all budget/selection transformation logic in its `util/` subfolder (Constitution VIII). `packages/ui` gets one new presentational pattern, built from existing primitives only (no new dependency). The existing `search` feature (already `stable`) gains two small, inert URL-codec functions alongside its existing `filter-url-state.ts`/`sort-url-state.ts` siblings (research D9) — safe because `apps/navigator` never renders the UI that would call them. Only `apps/navigator-experimental`'s route is modified to wire the new component in; `apps/navigator` is untouched.

## Complexity Tracking

> No violations — table intentionally left empty.
