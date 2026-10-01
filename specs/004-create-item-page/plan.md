# Implementation Plan: Create Item Page and Upload into Empty Content Attributes

**Branch**: `ACC-3217-create-item-page` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-create-item-page/spec.md`

## Summary

Add a `/~create` page where the user optionally attaches a file and chooses an entity (only those with a create form); choosing navigates immediately to the existing `/$entity/~create` route, with the file prefilled in the first file field when the entity has one. As in the original Navigator, the file stays attached (in memory) until an item is created or the user removes it. The create form's toolbar gets the same selector to switch entity. The entity picker extends the existing, unused `ProfileEntitySelector` pattern in `@contentgrid/ui` into a rich, reusable selector styled like the attribute selector. Separately, wire the content-focus "No file" drop zone to the existing `useUploadContent` hook, gated on `canUploadContent`. Decisions are recorded in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: TanStack Router and Query, Zustand, shadcn/ui (Radix `Select`), `@contentgrid/navigator-data`. No new dependencies.

**Storage**: none — the pending file is held in memory only.

**Testing**: Vitest + Testing Library; Storybook stories with Playwright visual snapshots (ADR-009); Playwright e2e in `apps/navigator/tests/e2e`.

**Target Platform**: evergreen browsers.

**Project Type**: pnpm monorepo web frontend (apps + shared packages).

**Performance Goals**: no measurable change; the Create item page reuses already-loaded profile queries.

**Constraints**: no URL construction; operations gated on template/link presence; `packages/ui` free of data imports; apps stay routing-only.

**Scale/Scope**: 1 new route (×2 apps), 1 new view, 1 toolbar switcher, 1 small store, 1 extended pattern, 2 edited content-focus components, 1 edited create container, 1 edited create route (×2 apps).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                            | Status | Notes                                                                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| I. HAL is the only interaction model | Pass   | Entities from `useLoadedProfileEntities`; upload via `useUploadContent` (the documented `cg:content` exception). |
| II. Model-first                      | Pass   | No entity/attribute names; file field found by `kind === "file"`; icon/colour from display preferences.          |
| III. Two-layer dependency model      | Pass   | `ProfileEntitySelector` takes plain options + `ReactNode` icon; the `ProfileEntity` mapping lives in features.   |
| IV. Three-track delivery             | Pass   | Code lands in `entity-item-create` and `entity-item`, both `x-stability: stable`; route added to both apps.      |
| V. Deny-by-default ABAC              | Pass   | Entities gated on `createTemplate`; drop zone gated on `canUploadContent`; 412 not auto-retried.                 |
| VI. Authentication                   | Pass   | Upload uses `contentFetch` (bearer header), unchanged.                                                           |
| VII. Supply chain                    | Pass   | No dependency, lockfile or workflow changes.                                                                     |
| VIII. View-owned data loading        | Pass   | `ClassifyCreateEntityItemView` and `ContentPreviewPanel` own their hooks; routes only render and navigate.       |

Re-check after Phase 1: still passes — contracts add no data imports to `ui` and no data loading to apps.

## Project Structure

### Documentation (this feature)

```text
specs/004-create-item-page/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── entity-selector-pattern.md
    ├── classify-create-entity-item-view.md
    └── content-upload-empty-attribute.md
```

### Source Code (repository root)

```text
packages/ui/src/patterns/entity-selector/
├── entity-selector.tsx            # extend (contracts/entity-selector-pattern.md)
├── entity-selector.test.tsx
├── entity-selector.stories.tsx
└── index.ts                       # export ProfileEntityOption type

packages/features/src/entity-item-create/
├── classify-create-entity-item-view.tsx           # NEW
├── classify-create-entity-item-view.test.tsx      # NEW
├── state/create-entity-item-state.ts       # NEW
├── state/use-entity-item-create-form-state.ts  # reset(initialValues?) — new baseline
├── test-utils.tsx                           # NEW: profile MSW fixtures
├── create-entity-item-profile-selector.tsx               # NEW: toolbar entity switch (US4)
├── create-entity-item-profile-selector.test.tsx          # NEW
├── use-creatable-profile-entities.tsx         # NEW: shared ProfileEntity → option mapping
├── create-entity-item-container.tsx         # prefill from pending file; clear on create/remove
├── create-entity-item-container.test.tsx
└── index.ts                       # export ClassifyCreateEntityItemView

packages/features/src/entity-item/variations/content-focus/components/
├── content-preview-frame.tsx      # uploading state; conditional drop zone
├── content-preview-frame.test.tsx
├── content-preview-frame.stories.tsx
├── content-preview-panel.tsx      # useUploadContent wiring
└── content-preview-panel.test.tsx

packages/features/src/layout/sidebar-layout.tsx   # Create Item → /~create

apps/navigator/src/routes/_app/~create.tsx               # NEW
apps/navigator-experimental/src/routes/_app/~create.tsx  # NEW (mirror)
apps/navigator*/src/routes/_app/$entity/~create.tsx      # toolbar switcher; key form on profile.name
apps/navigator*/src/routeTree.gen.ts                     # regenerated
apps/navigator/tests/e2e/fixtures.ts, navigator.spec.ts  # e2e
```

**Structure Decision**: follows the existing split — presentational pattern in `packages/ui`, page logic and state in `packages/features`, routing only in `apps/*`.

## Implementation Sequence (input for `/speckit-tasks`)

1. **ui** — extend `ProfileEntitySelector` per contract; update tests and stories; re-baseline snapshots. (US1, FR-011–013)
2. **features** — pending-create-file store. (FR-008)
3. **features** — `ClassifyCreateEntityItemView` + tests; export from `entity-item-create`. (US1, US2 page part)
4. **features** — create container prefill, clear on successful create / file removed + tests. (US2; end-to-end needs ACC-2895)
5. **features + apps** — `CreateEntityItemProfileSelector` + shared option hook; add it to the `$entity/~create` toolbar in both apps and key the form on `profile.name`. (US4, FR-020–021)
6. **apps + sidebar** — `~create` routes in both apps, regenerate route trees, sidebar link. (FR-001, FR-004, FR-005)
7. **features** — content-focus upload: frame `uploading` state + conditional drop zone; panel mutation, error, 412; tests + story. (US3)
8. **e2e** — Create item page flow.
9. **Review gate** — re-read `packages/ui/CLAUDE.md`, `packages/features/CLAUDE.md`, `packages/navigator-data/CLAUDE.md` and `apps/*/CLAUDE.md` against the diff; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

Steps 1–6 (Create item page and entity switch) and step 7 (upload) are independent and can be split into two PRs.

## Dependencies

- **ACC-2895** must merge before step 4 can be verified end to end (create-form `FileRenderer`). Step 4's unit test can assert the form state's initial value without it.

## Complexity Tracking

No constitution violations.
