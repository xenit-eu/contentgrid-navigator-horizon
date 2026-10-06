# Implementation Plan: Views Layer Between Apps and Features

**Branch**: `ACC-3216-1-spec` (stack ACC-3216, PRs 1–10) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-views-layer/spec.md`

## Summary

Add `packages/views` between the apps and `packages/features`. The app reads the address and passes a `ViewTarget` (names or an API link) plus an optional view state; a view loads the main data, draws its toolbar and places features or child views; features fill the space they get and report actions through callbacks. Navigation goes through one host-provided navigation object. The first pages to move are the item detail page and the collection page; then the shells and layout, then a list and detail split view. Stability tags move from features to views, preferences move to `navigator-data`, and lint enforces the layer imports. The work is ten stacked PRs: this one (documents only) and nine implementation PRs.

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: TanStack Router and Query, Zustand (client state, ADR-001), shadcn/ui, `@contentgrid/navigator-data`. No new third-party dependencies; `packages/views` is a new workspace package (its lockfile entry is CODEOWNERS-reviewed).

**Storage**: none new; display preferences keep their browser storage by default, with the storage becoming configurable (PR 9).

**Testing**: Vitest + Testing Library; MSW-backed hook tests (ADR-014); Storybook stories with Playwright visual snapshots in a fixed-size box (ADR-009); the existing Playwright e2e suite must pass unchanged.

**Target Platform**: evergreen browsers.

**Project Type**: pnpm monorepo web frontend (apps + shared packages).

**Performance Goals**: no regression; a route preload makes the view's first render a cache read (SC-003).

**Constraints**: no URL construction or parsing; operations gated on template/link presence; `packages/ui` free of data imports; routes thin; no behaviour change while pages move (FR-038); the stability gate in the generic app stays suspended pre-GA.

**Scale/Scope**: 1 new package, 2 pages moved into views (item detail, collection), 2 features stripped of page layout, shells and layout moved, 1 new split view, preferences moved, 5 lint rules.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against constitution v1.7.0 (this PR amends Principles III, IV and VIII; see `docs/adr/ADR-018-views-layer.md`).

| Principle                               | Status | Notes                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. HAL is the only interaction model    | Pass   | Link targets resolve through the response's profile link or the profiles' `describes` links; no URL is built or parsed ([view-target.md](contracts/view-target.md)). Filters go through `searchTemplate`; the page key stays an opaque cursor key; item ids come from `id`.               |
| II. Model-first                         | Pass   | Views take entity names as plain values and discover everything from the profile; no entity or attribute name is hardcoded.                                                                                                                                                               |
| III. Two-layer dependency model         | Pass   | `packages/views` imports `navigator-data`, `features` and `ui`; `navigator-data` and `ui` import no views. Amended in this PR to add the `packages/views` boundary. `navigator-data` gains a Zustand peer dependency in PR 9 (open question 4d; ADR-007 consequence recorded in ADR-018). |
| IV. Three-track delivery                | Pass   | The tag moves from features to views in PR 10 (amended in this PR); until then features keep theirs. The generic-app gate stays suspended pre-GA. New views start at `stable` pre-GA like new features.                                                                                   |
| V. Deny-by-default ABAC                 | Pass   | Moved pages keep gating every operation on template or link presence; views add no operation. The toolbar actions keep their `can*` gates.                                                                                                                                                |
| VI. Authentication                      | Pass   | No change; preloads use the router context's API client, which carries the bearer token.                                                                                                                                                                                                  |
| VII. Supply chain                       | Pass   | No new third-party dependency; a new workspace package changes `pnpm-lock.yaml` importers only, and goes through code-owner review.                                                                                                                                                       |
| VIII. View-owned data loading (amended) | Pass   | See detail below.                                                                                                                                                                                                                                                                         |
| IX. Spec traceability & self-contained  | Pass   | Every task in [tasks.md](tasks.md) cites FR and contract IDs; no local path or external document is referenced; the design is summarised inline and cited by Jira key only.                                                                                                               |

### Principle VIII in detail

| Bullet (v1.7.0)                                                                                                                               | How this plan complies                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An app passes a view only primitive props and the view state; never a resolved domain object it fetched itself.                               | `ViewTarget` is names or a link string; state is plain data ([view-props-and-state.md](contracts/view-props-and-state.md)). The collection route stops loading `ProfileEntity` (PR 4 and PR 6). |
| An app's route-level responsibility is: choose the view, supply target/state, and guarantee loading before mount through the router `loader`. | The route loader calls the view's `preload(ctx, target, state)` ([view-preload.md](contracts/view-preload.md)); the pending, error and not-found components stay the router's.                  |
| A view gates its own loading/error/not-found state through one shared primitive.                                                              | The shared gate lives in `packages/views` (data-only parts in `navigator-data`); today's `EntityProfileGate` moves in PR 7 and views share it (FR-006).                                         |
| A view computes its own default page content (toolbar) from its data, overridable, and can be told not to draw it.                            | [view-toolbar.md](contracts/view-toolbar.md): views draw breadcrumbs and actions; a host or parent can turn the toolbar off; features never draw it.                                            |
| Navigation goes through the navigation context; callback props remain fine for one-page-only actions.                                         | [navigation-context.md](contracts/navigation-context.md): views and features never use the router; "after create go to the new item" stays a prop.                                              |
| Views receive view state alongside the target.                                                                                                | `ViewProps<S>`; the app maps the address to state and back.                                                                                                                                     |
| Transformation logic lives in `util/` layers, not inline in views or components.                                                              | State and request building live in `navigator-data` helpers and each view's `util/`; views orchestrate only. The filter, sort and page logic leaves the route file for helpers in PR 6.         |

Existing code that has not migrated (the route files, `EntityProfileGate`, the feature wrappers with `PageLayout`) is not retroactively non-compliant; PRs 4–7 migrate it.

Re-check after Phase 1: still passes. The contracts add no data imports to `ui` and no data loading to apps.

## Project Structure

### Documentation (this feature)

```text
specs/005-views-layer/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── checklists/requirements.md
├── contracts/
│   ├── view-target.md
│   ├── view-props-and-state.md
│   ├── navigation-context.md
│   ├── view-preload.md
│   ├── view-toolbar.md
│   └── layer-lint-rules.md
└── tasks.md
```

Documents outside the spec directory changed by PR 1: `docs/adr/ADR-018-views-layer.md` (new), `docs/adr/ADR-007-two-layer-dependency-model.md` (amendment note), `docs/adr/README.md`, root `CLAUDE.md` (ADR list) and `.specify/memory/constitution.md` (v1.7.0).

### Source Code (repository root)

```text
packages/views/                    # NEW (PR 2)
├── package.json                   # per-view exports; x-stability per view from PR 10
├── src/
│   ├── navigation/                # context, provider, useNavigation, recording fake (PR 2)
│   ├── types.ts                   # ViewProps<S>, view state types, ViewPreload (PR 2)
│   ├── entity-item-detail/        # item detail view + preload + relation-problem dialog (PR 4)
│   ├── entity-item-collection/    # collection view + state (PR 5 wrapper, PR 6 state)
│   ├── layout/                    # moved from features/layout (PR 7)
│   ├── shells/                    # moved from features/shells (PR 7)
│   └── entity-item-split/         # list and detail split view (PR 8)
└── CLAUDE.md

packages/navigator-data/src/
├── views/                         # target resolution helpers (PR 3)
└── preferences/                   # hook, merge, store with storage option (PR 9)

packages/features/src/
├── entity-item/                   # stripped of toolbar, breadcrumbs, actions, PageLayout (PR 5)
├── entity-item-collection/        # same (PR 5)
├── dashboard/, app-info-pages/    # router calls removed (PR 7)
├── layout/, shells/               # moved out (PR 7)
└── preferences/                   # moved out (PR 9)

packages/eslint-config/rules/      # layer rules; no-unstable-features checks views (PR 10)

apps/navigator/src/routes/, apps/navigator-experimental/src/routes/
└── thin route files: URL -> target/state, loader -> preload, navigation provider (PR 4, 6, 7)
```

**Structure Decision**: one new workspace package `packages/views`, exposing each view through its own export path so the stability tag and the lint rule can resolve it per view, like features today. Target resolution and preferences are data concerns and go into `navigator-data` (Principle III).

## PR breakdown

| PR  | Title (ACC-3216)                            | Requirements                                           | Notes                                                                                           |
| --- | ------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Spec, ADR-018, constitution amendment       | all (documents)                                        | This PR. Documents only.                                                                        |
| 2   | `packages/views` scaffold                   | FR-001, FR-011, FR-012, FR-016, FR-017, FR-019         | Navigation context, provider, hook, recording fake, view props and state types.                 |
| 3   | navigator-data target resolution            | FR-008, FR-009, FR-010                                 | Names or link into loaded objects; profile via link or `describes`; cache under self link.      |
| 4   | Item detail view                            | FR-002, FR-003, FR-004, FR-006, FR-023, FR-037, FR-038 | First route moved; both apps use it; preload, toolbar and relation-problem dialog.              |
| 5   | Strip page layout from features             | FR-021, FR-022, FR-023, FR-024                         | Item and collection features fill their space; views draw the toolbar. Visual baselines change. |
| 6   | Collection view with state                  | FR-011–FR-014, FR-018, FR-037                          | Filters, sort, page in view state; the apps wire them to search params.                         |
| 7   | Move shells and layout; remove router calls | FR-006, FR-016, FR-036                                 | The unsaved-changes guard stays (open question 3).                                              |
| 8   | List and detail split view                  | FR-015, FR-025, FR-026, FR-027                         | First view made of two views.                                                                   |
| 9   | Preferences move to navigator-data          | FR-030–FR-033                                          | Store created by the app with configurable storage.                                             |
| 10  | Stability on views; layer lint rules        | FR-028, FR-029, FR-034, FR-035                         | The generic-app gate stays suspended pre-GA.                                                    |

Each implementation PR is traceable to `tasks.md` (constitution Principle IX). If a PR finds the spec wrong, it amends the spec in the same PR.

## Complexity Tracking

> No Constitution Check violations. Two points a reviewer may question:

| Point                                                    | Why Needed                                                                                     | Simpler Alternative Rejected Because                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A new package instead of a folder in `packages/features` | Layers need a lint-enforceable boundary and a per-view stability tag; custom repos consume it  | A folder cannot stop features from importing it back without a path-based rule, and mixes two layers   |
| Two inputs (target and state) instead of one             | The app must be the only layer that knows the address format; a link must not carry list state | One input would force the view to know the app's route format, or mix what to show with how to show it |
