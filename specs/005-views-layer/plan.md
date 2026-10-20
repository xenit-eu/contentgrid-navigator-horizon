# Implementation Plan: Views Layer Between Apps and Features

**Branch**: `ACC-3216-1-spec` (stack ACC-3216, PRs 1–8) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-views-layer/spec.md`

## Summary

Add `packages/views` between the apps and `packages/features`. The app reads the address and passes each view its own explicit props (for example an entity name and item id) plus, where a view has one, its own state type; a view loads the main data, draws its toolbar and places features or child views; features fill the space they get and report actions through callbacks. There is no shared target or props type — the only thing every view shares is its toolbar on/off switch. Navigation goes through one host-provided navigation object. The first pages to move are the item detail page and the collection page; then the shells and layout, then a list and detail split view. Stability tags move from features to views, display preferences move into their own `user-preferences` feature, and lint enforces the layer imports. The work is eight stacked PRs: this one (documents only) and seven implementation PRs.

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: TanStack Router and Query, Zustand (client state, ADR-001), shadcn/ui, `@contentgrid/navigator-data`. No new third-party dependencies; `packages/views` is a new workspace package (its lockfile entry is CODEOWNERS-reviewed).

**Storage**: none new; display preferences keep their browser storage by default, with the storage becoming configurable (PR 8).

**Testing**: Vitest + Testing Library; MSW-backed hook tests (ADR-014); Storybook stories with Playwright visual snapshots in a fixed-size box (ADR-009); the existing Playwright e2e suite must pass unchanged.

**Target Platform**: evergreen browsers.

**Project Type**: pnpm monorepo web frontend (apps + shared packages).

**Performance Goals**: no regression; a route preload makes the view's first render a cache read (SC-003).

**Constraints**: no URL construction or parsing; operations gated on template/link presence; `packages/ui` free of data imports; routes thin; no behaviour change while pages move (FR-038); the stability gate in the generic app stays suspended pre-GA.

**Scale/Scope**: 1 new package, 2 pages moved into views (item detail, collection), 2 features stripped of page layout, shells and layout moved, 1 new split view, preferences moved, 5 lint rules.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against constitution v1.7.0 (this PR amends Principles III, IV and VIII, to v1.9.0 across two review rounds; see `docs/adr/ADR-018-views-layer.md`).

| Principle                               | Status | Notes                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. HAL is the only interaction model    | Pass   | Item ids come from `id`; filters go through `searchTemplate`; the page key stays an opaque cursor key. The item detail and collection views resolve a link (FR-008–FR-010) by matching it against the already-loaded profiles' `describes` links, never by parsing the URL.                                                                                     |
| II. Model-first                         | Pass   | Views take entity names as plain values and discover everything from the profile; no entity or attribute name is hardcoded.                                                                                                                                                                                                                                     |
| III. Two-layer dependency model         | Pass   | `packages/views` imports `navigator-data`, `features` and `ui`; `navigator-data` and `ui` import no views. Amended in this PR to add the `packages/views` boundary. Preferences move within `packages/features` (its own `user-preferences` feature); no new peer dependency, since `packages/features` already depends on Zustand (open question 4d resolved). |
| IV. Three-track delivery                | Pass   | The tag moves from features to views in PR 8 (amended in this PR); until then features keep theirs. The generic-app gate stays suspended pre-GA. New views start at `stable` pre-GA (assumption, not in the design; see spec Assumptions).                                                                                                                      |
| V. Deny-by-default ABAC                 | Pass   | Moved pages keep gating every operation on template or link presence; views add no operation. The toolbar actions keep their `can*` gates.                                                                                                                                                                                                                      |
| VI. Authentication                      | Pass   | No change; preloads use the router context's API client, which carries the bearer token.                                                                                                                                                                                                                                                                        |
| VII. Supply chain                       | Pass   | No new third-party dependency; a new workspace package changes `pnpm-lock.yaml` importers only, and goes through code-owner review.                                                                                                                                                                                                                             |
| VIII. View-owned data loading (amended) | Pass   | See detail below.                                                                                                                                                                                                                                                                                                                                               |
| IX. Spec traceability & self-contained  | Pass   | Every task in [tasks.md](tasks.md) cites FR and contract IDs; no local path or external document is referenced; the design is summarised inline and cited by Jira key only.                                                                                                                                                                                     |

### Principle VIII in detail

| Bullet (v1.7.0)                                                                                                                                  | How this plan complies                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| An app passes a view only plain-value props and the view state; never a resolved domain object it fetched itself.                                | Each view declares its own explicit props (e.g. an entity name and item id, or a link such as `itemUrl`/`collectionUrl`) and its own state type, all plain data ([view-props-and-state.md](contracts/view-props-and-state.md)). The collection route stops loading `ProfileEntity` (PR 3).       |
| An app's route-level responsibility is: choose the view, supply its props/state, and guarantee loading before mount through the router `loader`. | Where a view exports one, the route loader calls its own `preload`, built around `navigator-data`'s `ensure*` helpers over the query factories the view's own hooks use ([view-data-loading.md](contracts/view-data-loading.md)); the pending, error and not-found components stay the router's. |
| A view handles its own loading/error/not-found state, rendered with the shared `LoadingPage`/`ErrorPage` components.                             | Each view renders these states itself from `@contentgrid/features/app-info-pages` (errors via `toProblemDisplayModel`); no shared gate hook or component layer is introduced (FR-006).                                                                                                           |
| A view computes its own default page content (toolbar) from its data and can be told not to draw it.                                             | [view-toolbar.md](contracts/view-toolbar.md): views draw breadcrumbs and actions; a host or parent can turn the toolbar off; features never draw it.                                                                                                                                             |
| Navigation goes through the navigation context; callback props remain fine for one-page-only actions.                                            | [navigation-context.md](contracts/navigation-context.md): only views call the navigation object (features get callback props), and neither uses the router; "after create go to the new item" stays a prop.                                                                                      |
| Views receive view state alongside their identifying props.                                                                                      | Each view's own props type carries `state`/`onStateChange` next to its identifying props; the app maps the address to state and back ([view-props-and-state.md](contracts/view-props-and-state.md)).                                                                                             |
| Transformation logic lives in `util/` layers, not inline in views or components.                                                                 | State and request building live in `navigator-data` helpers and each view's `util/`; views orchestrate only. The filter, sort and page logic leaves the route file for helpers in PR 3.                                                                                                          |

Existing code that has not migrated (the route files, `EntityProfileGate`, the feature wrappers with `PageLayout`) is not retroactively non-compliant; PRs 3–5 migrate it.

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
│   ├── view-props-and-state.md
│   ├── navigation-context.md
│   ├── view-data-loading.md
│   ├── view-toolbar.md
│   └── layer-lint-rules.md
└── tasks.md
```

Documents outside the spec directory changed by PR 1: `docs/adr/ADR-018-views-layer.md` (new), `docs/adr/ADR-007-two-layer-dependency-model.md` (amendment note), `docs/adr/README.md`, root `CLAUDE.md` (ADR list) and `.specify/memory/constitution.md` (v1.9.0).

### Source Code (repository root)

```text
packages/views/                    # NEW (PR 2)
├── package.json                   # per-view exports; x-stability per view from PR 8
├── src/
│   ├── navigation/                 # context, provider, useNavigation, recording fake (PR 2)
│   ├── types/view.tsx              # only the shared bits (the toolbar switch); each view's own props/state live with that view (PR 2)
│   ├── hooks/                      # useProfileEntityTarget, useEntityItemTarget — by name or by link, no shared resolver (PR 3)
│   ├── breadcrumbs/                # HomeBreadcrumb, CollectionBreadcrumb, ItemBreadcrumb + one export per page (PR 3)
│   ├── entity-item-detail/         # item detail view + preload + relation-problem dialog (PR 3)
│   ├── entity-item-collection/     # collection view + state, thin list route (PR 3)
│   ├── layout/                     # moved from features/layout (PR 5)
│   ├── shells/                     # moved from features/shells (PR 5)
│   └── entity-item-split/          # list and detail split view (PR 6)
└── CLAUDE.md

packages/navigator-data/src/
└── preferences/                   # unchanged: keeps only the EntityDisplayPreferences type and the backend part it already has

packages/features/src/
├── entity-item/                   # stripped of toolbar, breadcrumbs, actions, PageLayout (PR 4)
├── entity-item-collection/        # same (PR 4)
├── dashboard/, app-info-pages/    # router calls removed (PR 5)
├── layout/, shells/               # moved out (PR 5)
└── user-preferences/              # merge, hook, store with storage option; reorganised from preferences/ (PR 7)

packages/eslint-config/rules/      # layer rules; no-unstable-features checks views (PR 8)

apps/navigator/src/routes/, apps/navigator-experimental/src/routes/
└── thin route files: URL -> view props/state, loader -> preload, navigation provider (PR 3, 5)
```

**Structure Decision**: one new workspace package `packages/views`, exposing each view through its own export path so the stability tag and the lint rule can resolve it per view, like features today. There is no shared target-resolution or generic-props package to add — each view resolves its own data through existing `navigator-data` hooks. Preferences stay a `packages/features` concern, in their own feature, since other stable features may already import one another (Principle III).

## PR breakdown

| PR  | Title (ACC-3216)                                   | Requirements                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Spec, ADR-018, constitution amendment              | all (documents)                                                              | This PR. Documents only.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | `packages/views` scaffold                          | FR-001, FR-011, FR-012, FR-016, FR-017, FR-019                               | Navigation context, provider, hook, recording fake, the toolbar switch (the one thing every view's props share).                                                                                                                                                                                                                                                                                                           |
| 3   | Item detail view and collection view with state    | FR-002–FR-004, FR-006, FR-008–FR-014, FR-017, FR-018, FR-023, FR-037, FR-038 | First two routes moved; both apps use them. View-local target hooks resolve by entity name or by link (`itemUrl`/`collectionUrl`), shared breadcrumb components, preloads (via `ensureQueryData`), toolbars, the relation-problem dialog, and the relation popover's "create missing target" callback wired to `navigation.openCreateItem`. Filters, sort and page live in the collection view's own state from the start. |
| 4   | Strip page layout from features                    | FR-021, FR-022, FR-023, FR-024                                               | Item and collection features fill their space; views draw the toolbar. Visual baselines change.                                                                                                                                                                                                                                                                                                                            |
| 5   | Move shells and layout; remove router calls        | FR-006, FR-016, FR-036                                                       | The unsaved-changes guard stays (open question 3).                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | List and detail split view                         | FR-015, FR-025, FR-026, FR-027                                               | First view made of two views; ships the view and a story only (no route until open question 2 is settled).                                                                                                                                                                                                                                                                                                                 |
| 7   | Preferences move into a `user-preferences` feature | FR-030–FR-033                                                                | No peer-dependency gate: the store stays inside `packages/features`, which already depends on Zustand (open question 4d resolved). Store created by the app with configurable storage.                                                                                                                                                                                                                                     |
| 8   | Stability on views; layer lint rules               | FR-028, FR-029, FR-034, FR-035                                               | The generic-app gate stays suspended pre-GA.                                                                                                                                                                                                                                                                                                                                                                               |

### How this differs from the design's plan

The design's plan has eight steps. This breakdown differs in four ways:

- **The design's "target resolution" step is dropped, not deferred to a later PR.** The design describes a shared `navigator-data` mechanism that turns a name or a link into loaded objects once. Review of this series concluded that views should resolve their own data by calling `navigator-data`'s existing hooks directly — a view "knows which data it needs" and should not depend on a generic helper built for an abstraction it does not need yet. Opening a view from a link is not deferred at the view level either (FR-008–FR-010): the item detail and collection views both resolve one directly, through their own `useEntityItemTarget`/`useProfileEntityTarget` hooks built on `navigator-data`'s existing hooks, with no shared target type or resolution package. What stays deferred is a second host actually exercising that mode — the chat assistant itself (User Story 3) — not the mechanism a view would need to do it.
- **PR 2 (scaffold) is an extra step, and the collection view's state is folded into PR 3 instead of its own step.** The design has no step for creating the package; PR 2 gives every later PR a package and a navigation context to build on. The design's single route step (item detail) becomes PR 3's two views — item detail and collection, the latter with its filter/sort/page state from the start — because they share the same breadcrumb components and the same by-name-or-by-link hook pattern, and proving the state split needs a second route in place before shells, layout and the split view build on it. There is no longer a separate step to move the collection route's filter, sort and page logic in later; it ships with the view that needs it.
- **Preferences (PR 7) come before stability (PR 8).** The design moves stability first, then preferences, then adds the lint rules. Nothing technical forces either order; PR 7 no longer needs to wait on a team answer (open question 4d is resolved — preferences stay in `packages/features`, so no peer dependency is added anywhere), and PR 8 holds the layer rules that must come last regardless, since they need all moved code in place. The two can be swapped if the team prefers the design's order.
- **Stability and the layer lint rules are merged into one PR (PR 8).** The design lists them as two steps; both change the same ESLint configuration and the same rule, so they land together.

Each implementation PR is traceable to `tasks.md` (constitution Principle IX). If a PR finds the spec wrong, it amends the spec in the same PR.

## Complexity Tracking

> No Constitution Check violations. Two points a reviewer may question:

| Point                                                                        | Why Needed                                                                                                  | Simpler Alternative Rejected Because                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A new package instead of a folder in `packages/features`                     | Layers need a lint-enforceable boundary and a per-view stability tag; custom repos consume it               | A folder cannot stop features from importing it back without a path-based rule, and mixes two layers               |
| Identifying props and state kept separate, instead of folded into one object | The app must be the only layer that knows the address format; an identifying prop must not carry list state | Folding them together would force the view to know the app's route format, or mix what to show with how to show it |
