# Implementation Plan: Add Edit Form

**Branch**: `ACC-3210-spec-add-edit-form` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-add-edit-form/spec.md`

## Summary

Add an edit mode to the entity item detail page. Choosing Edit swaps the item's attribute panel for a form generated from the item's `default` HAL-FORMS template, pre-filled from the item body. Content attributes can be replaced or removed; those changes are queued and applied on Save after the metadata update, each step carrying the ETag of the step before it. Conflicts (412) reload the item and keep the user's changes. The logic follows the legacy Navigator's edit flow (`research.md` §1); the presentation, validation and error display reuse the Horizon create form.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Query (server state), TanStack Router (routes only; no new route), `@contentgrid/hal-forms` codecs via `@contentgrid/navigator-data`, shadcn/ui + Tailwind 4 in `@contentgrid/ui`, sonner (toasts), `@embedpdf` PDF viewer (local preview)

**Storage**: N/A (ContentGrid REST API; item metadata PUT, binary content on `cg:content` links)

**Testing**: Vitest + Testing Library (unit, hook), MSW (HAL contract tests), Storybook stories with play tests + Playwright snapshots (patterns), Playwright e2e against the MSW demo handlers

**Target Platform**: evergreen desktop and mobile browsers

**Project Type**: pnpm monorepo web frontend (`packages/navigator-data`, `packages/features`, `packages/ui`, `apps/navigator`, `apps/navigator-experimental`)

**Performance Goals**: edit mode opens without a network request (item already loaded); SC-002 — saved value visible in under 5 s excluding upload time

**Constraints**: constitution principles I–VIII; no new dependencies (VII); no new route (FR-003); reduced-motion respected (FR-003a)

**Scale/Scope**: every entity of any application; forms up to ~50 properties; up to a few content attributes per item

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below)._

| Principle           | Check                                                                                                                                                                                                                                 | Status                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| I. HAL only         | Metadata PUT built by `editEntityRequest` from the `default` template via its codec; values set through `createValues`; `If-Match` on every step; 412 surfaced, re-fetch + re-apply done by the feature, never auto-retried in a hook | ✅                                  |
| I. Binary exception | Content upload keeps `uploadContentRequest` (documented exception). **Removing a file adds `deleteContentRequest`** — a third hand-built request                                                                                      | ⚠️ justified in Complexity Tracking |
| II. Model-first     | Form generated from the template; content attributes found with `attr.isContent`; the `filename`/`mimetype` mapping lives in `navigator-data` (`UpdateHalFormTemplate`), next to `ContentMetadata`                                    | ✅                                  |
| III. Boundaries     | Save orchestration and accessors in `navigator-data`; view/panel/state in `features`; plain-prop inputs in `ui` (no `FieldDescriptor` in `ui`); no Layer-1 import from `features`                                                     | ✅                                  |
| IV. Stability       | Changes extend `entity-item` and `entity-item-create`, both `stable`; pre-GA exception applies, no new feature directory                                                                                                              | ✅                                  |
| V. ABAC             | Edit gated on `entityItem.canUpdate`; file controls on `canUploadContent` / `canDeleteContent`; 403 after submit treated as policy outcome (FR-022)                                                                                   | ✅                                  |
| VI. Auth            | No change; all requests go through `apiFetch`/`contentFetch`                                                                                                                                                                          | ✅                                  |
| VII. Supply chain   | No new dependency. `xhr-fetch.ts` is lifted from an existing branch, not installed                                                                                                                                                    | ✅                                  |
| VIII. Views         | Edit mode owned by the views; apps pass only an optional `allowEdit` boolean; value decoding, wire-type mapping and conflict merge in `util/`                                                                                         | ✅                                  |
| Error handling      | `toProblemDisplayModel` → `ProblemAlert` (`VersionConflictAlert` for 412); field errors via `getValidationFieldErrors` → `toFieldErrors`; non-field fallback as in `entity-item-create`                                               | ✅                                  |
| Quality gates       | MSW fixtures for PUT/412/content PUT+DELETE; stories for new patterns; browser run of golden path + failures before done                                                                                                              | ✅ planned                          |

**Post-design re-check**: unchanged. The only deviation remains D2 (content DELETE).

## Project Structure

### Documentation (this feature)

```text
specs/003-add-edit-form/
├── plan.md              # This file
├── research.md          # Legacy analysis + Phase 0 decisions (D1–D8)
├── data-model.md        # Phase 1: edit session, pending file changes, save steps
├── quickstart.md        # Phase 1: how to verify the feature
├── contracts/           # Phase 1: module interfaces
│   ├── navigator-data.md
│   ├── features.md
│   └── ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
packages/navigator-data/
├── src/accessors/
│   ├── entity-item.ts                         # + updateTemplate, deleteContentRequest, canDeleteContent
│   └── extended-forms/update-form.ts          # NEW UpdateHalFormTemplate
├── src/api/xhr-fetch.ts                       # NEW (lifted from ACC-3090) upload progress
├── src/hooks/item/use-save-entity-item-edit.ts # NEW save orchestration (D1)
├── src/index.ts, src/hooks/index.ts           # exports
└── test-fixtures/msw/handlers.ts              # + content DELETE handler, 412 on PUT

packages/features/src/
├── entity-item-create/
│   ├── model/resolve-edit-field-descriptors.ts # NEW (D4)
│   ├── model/field-descriptor.ts              # file variant + optional metadata
│   ├── render/field-renderer.tsx              # file field: current file, pending change, filename input
│   └── util/                                  # NEW shared wire-type mapping, value decoding
├── entity-item/
│   ├── edit/                                  # NEW
│   │   ├── entity-item-edit-panel.tsx         # form + pinned action bar + alerts
│   │   ├── use-entity-item-edit-session.ts    # edit state, pending files, dirty, save, conflict merge
│   │   └── util/merge-after-conflict.ts
│   ├── entity-item-view.tsx                   # isEditing, Edit action, allowEdit
│   └── variations/content-focus/...           # same + local preview of pending file
└── (no new feature directory; no package.json change)

packages/ui/src/patterns/
├── form-renderers/file-renderer.tsx           # (ACC-2895) + current-file + pending/remove states
└── edit-action-bar/                           # NEW pinned Save/Cancel bar + unsaved indicator

apps/navigator/tests/e2e/edit-item.spec.ts     # NEW (attribute-focus + content-focus scenarios)
```

**Structure Decision**: no new package or feature directory. Data-layer additions sit next to the create-form and content accessors they mirror; the edit UI extends the two existing stable features (`entity-item`, `entity-item-create`) so both forms share one renderer, one state hook and one error path.

## Implementation phases (input to `/speckit-tasks`)

1. **Data layer** (US1 foundation): `UpdateHalFormTemplate`, `entityItem.updateTemplate`, value decoding helper, `useSaveEntityItemEdit` metadata-only path, MSW PUT + 412 fixtures.
2. **Edit UI, attributes only** (US1, MVP): `resolveEditFieldDescriptors`, shared `util/` wire-type mapping, `EntityItemEditPanel`, `EditActionBar`, edit mode in both views, unsaved-changes confirm, success toast, e2e.
3. **Files** (US2): `deleteContentRequest`, `xhr-fetch`, file steps in `useSaveEntityItemEdit`, file field states, local PDF preview, constitution amendment for D2 (same PR).
4. **Failures** (US3): conflict merge (D6), partial file failure + retry, 403/404 handling, e2e for each.
5. **Polish**: transitions + reduced motion, phone width, dark theme snapshots, browser verification per the quality gates.

Dependencies: phase 3 needs ACC-2895 (FileRenderer) merged; phases 1–2 can start now.

## Complexity Tracking

| Violation                                                                                                            | Why Needed                                                                                                                                      | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Third hand-built request: `deleteContentRequest` (constitution I names only content PUT/GET and `unlinkItemRequest`) | Removing a stored file (FR-008, US2 scenario 4) has no HAL-FORMS template, same as content PUT/GET; legacy uses DELETE on the `cg:content` link | Sending empty `filename`/`mimetype` in the metadata PUT leaves the bytes in storage and relies on undocumented server behaviour. Constitution I gets a matching amendment in the phase-3 implementation PR, naming content DELETE alongside PUT/GET (same link gate, `contentFetch`, `If-Match`) |
