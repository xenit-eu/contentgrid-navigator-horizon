# Implementation Plan: Feature View Architecture

**Branch**: `001-feature-view-architecture` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-feature-view-architecture/spec.md`

## Summary

Establish enforceable internal boundaries for feature views, components, shared forms, and pure
transformations without migrating an individual view. Preserve one application-level primary
profile gate, permit independently loading components after that gate opens, and make
`@contentgrid/ui` independently consumable by removing its Navigator data type dependency. Deliver
the architecture through shared contracts, compatibility exports, focused extraction of duplicated
utilities, custom ESLint rules, and package-level tests.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19.1; shared packages retain React 18/19 peer support

**Primary Dependencies**: React, TanStack Query 5, TanStack Router 1.170, Vite 8, Radix-backed
`@contentgrid/ui`, `@contentgrid/navigator-data`

**Storage**: N/A; frontend ownership and package contracts only

**Testing**: Vitest 4.1, React Testing Library 16.3, ESLint RuleTester, Storybook 10.4, Playwright

**Target Platform**: Modern browsers; Node.js 20+ and pnpm 11.5.2 for development and CI

**Project Type**: pnpm monorepo with reusable UI/data/feature packages and two React web apps

**Performance Goals**: Primary profile context blocks exactly once at the application gate;
secondary data does not block unrelated page regions; UI gains no Navigator runtime dependency

**Constraints**: No new dependency; preserve existing public feature export paths; no individual
view migration; no hardcoded domain names or URLs; no direct Layer-1 imports outside navigator-data;
UI accepts plain values and callbacks only

**Scale/Scope**: Four feature responsibilities (`views`, `components`, `forms`, `util`), app-wide
shells/gates, `@contentgrid/ui`, both app tracks, custom ESLint rules, and shared contracts

## Constitution Check

_GATE: Evaluated before research and re-evaluated after Phase 1 design._

### Pre-Design Gate

PASS with one documented deviation: Principle VIII's view-level primary gate conflicts with the
approved app-level gate. Governance alignment is the first implementation prerequisite.

### Post-Design Gate

PASS after governance alignment. Phase 1 contracts preserve every other constitutional boundary,
keep primary loading in the app gate, localize secondary loading to components, and remove UI's
Navigator package dependency.

| Principle                        | Pre-Design Evaluation                                                                                                                      | Post-Design Evaluation                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| I. HAL interaction model         | PASS: no request, URL, ETag, or cursor behavior changes                                                                                    | PASS: domain access remains behind navigator-data                                                                     |
| II. Model-first                  | PASS: views use runtime identifiers and discovered profile data                                                                            | PASS: no fixed entity or attribute names                                                                              |
| III. Package boundaries          | PASS WITH REPAIR: remove UI's current data-package type dependency and enforce one-way feature imports                                     | PASS: UI owns plain presentation types only                                                                           |
| IV. Three-track delivery         | PASS: no stability promotion or track-specific feature                                                                                     | PASS: compatibility exports serve both apps                                                                           |
| V. Deny-by-default ABAC          | PASS: operation availability remains server-advertised                                                                                     | PASS: no client permission inference                                                                                  |
| VI. Authentication               | PASS: no token or authentication change                                                                                                    | PASS                                                                                                                  |
| VII. Supply-chain integrity      | PASS: no install or lockfile change                                                                                                        | PASS                                                                                                                  |
| VIII. View loading and ownership | JUSTIFIED DEVIATION: approved spec assigns primary loading to one app gate; constitution currently mandates an additional shared view gate | PASS AFTER GOVERNANCE ALIGNMENT: amend Principle VIII before code delivery; secondary loading remains component-local |
| Error handling                   | PASS: standard full-page outcomes at the main gate; component errors remain local                                                          | PASS                                                                                                                  |
| Quality gates                    | PASS: lint, type, unit, story, visual, accessibility, and browser checks defined                                                           | PASS                                                                                                                  |

The Principle VIII deviation is documented under Complexity Tracking. Implementation MUST align the
constitution first; it MUST NOT silently ship contradictory code.

## Project Structure

### Documentation (this feature)

```text
specs/001-feature-view-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── data-loading.md
│   ├── feature-layer-imports.md
│   ├── feature-view.md
│   ├── forms-and-transformations.md
│   └── ui-standalone.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── navigator/src/routes/_app/$entity.tsx
└── navigator-experimental/src/routes/_app/$entity.tsx

packages/
├── eslint-config/rules/
│   ├── feature-layer-boundaries.ts
│   ├── feature-layer-boundaries.test.ts
│   ├── ui-package-independence.ts
│   └── ui-package-independence.test.ts
├── features/src/
│   ├── views/shells/
│   ├── components/
│   ├── forms/
│   │   ├── field-descriptor.ts
│   │   ├── layout-information.ts
│   │   ├── resolve-field-descriptors.ts
│   │   ├── field-renderer.tsx
│   │   └── index.ts
│   ├── util/
│   │   ├── hal-forms-wire-type.ts
│   │   ├── entity-item-collection/
│   │   ├── preferences/
│   │   └── search/
│   ├── layout/toolbar-options.ts
│   └── shells/entity-profile-gate/entity-profile-gate.test.tsx
└── ui/
   ├── package.json
   └── src/
      ├── field-value.ts
      ├── index.ts
      └── patterns/form-renderers/
```

**Structure Decision**: Keep features as one workspace package and add explicit responsibility
folders. Preserve existing subpath exports through forwarding barrels during mechanical moves. Keep
the primary profile gate app-wide; do not duplicate it inside views. Move the plain renderer value
contract into UI, then remove navigator-data from UI peer and development dependencies. Custom
ESLint rules enforce the internal import graph and standalone UI boundary.

## Implementation Sequence

1. Align Constitution Principle VIII and package guidance with the approved app-gate,
   partial-component, and standalone-UI contracts.
2. Add failing RuleTester fixtures for feature import direction and UI independence, then wire the
   rules into package-scoped ESLint config.
3. Add UI-owned `FieldValue`, switch renderer props, export it, remove UI's Navigator data
   dependencies, and validate UI in isolation.
4. Add toolbar, forms, util, components, and views/shells ownership surfaces with compatibility
   barrels. Extract reusable contracts only; do not migrate a feature view.
5. Consolidate wire-type classification and move search, collection, and preference transformations
   behind util exports, adding characterization tests before each extraction.
6. Add main-gate tests proving no view subtree mounts before primary context is ready and component
   tests proving secondary loading/errors preserve ready sibling content.
7. Run focused package checks, full repository checks, and browser/story validation from
   [quickstart.md](quickstart.md).

## Complexity Tracking

| Violation                                                                                                                                        | Why Needed                                                                                   | Simpler Alternative Rejected Because                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Principle VIII currently requires a shared view-level primary-data gate, while the approved spec assigns primary readiness to one app-level gate | One owner prevents duplicate whole-page branches and permits component-level partial loading | Keeping both gates creates two owners and can replace an otherwise usable page when secondary data changes |
