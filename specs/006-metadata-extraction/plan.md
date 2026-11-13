# Implementation Plan: Extract Metadata into the Create Form

**Branch**: `006-metadata-extraction` | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-metadata-extraction/spec.md`

## Summary

Add an **Extract metadata** action to the create form that sends the attached file, the entity profile's URL and an optional hint to the extract service, using its `basic-extract` / `advanced-extract` HAL-FORMS template. The result fills the empty fields the service is confident about and auto-links unambiguous relation candidates, through the form state's existing `setExternalValue`, which also shows the **Extracted** tag and its popover. A field the extraction has data for but did not write gets the same popover through a new `suggestExternalValue`, so the user can apply the value or pick a candidate. The data layer is a small `Extraction` / `EntityExtraction` accessor pair and an `ExtractService` accessor that follows the pattern of `ProfileEntity.createEntityItemRequest`. Decisions are recorded in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: TanStack Query, `@contentgrid/hal-forms` (values + codecs), `@contentgrid/navigator-data`, shadcn/ui primitives. No new dependencies.

**Storage**: none. The extraction is held in memory in the create container.

**Testing**: Vitest + Testing Library + MSW (see research §5).

**Target Platform**: evergreen browsers.

**Project Type**: pnpm monorepo web frontend (apps + shared packages).

**Performance Goals**: no change when no extract service is configured; the extract home is fetched once and cached.

**Constraints**: extraction request built only from the extract template; the token-exchange URL is the only URL the client builds (Complexity Tracking); candidate hrefs used as given and ids read from fetched items; `packages/ui` unchanged; apps unchanged.

**Scale/Scope**: in `navigator-data`, 2 new accessors, 2 new hooks and 1 new fetch client; in `features`, 1 util moved, 1 new util and 4 new components in `entity-item-create`, 1 edited container, 1 method added to the shared `hal-forms` field state.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                            | Status                         | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. HAL is the only interaction model | Pass (see Complexity Tracking) | The extract request is built from the service's own `basic-extract` / `advanced-extract` template with `createValues` and `halFormCodecs`. The home URL is the configured service root, like `apiBaseUrl`. Candidate hrefs are used as given. The token-exchange URL is an authentication endpoint, not a HAL resource. |
| II. Model-first                      | Pass                           | Fields are matched by the names in the create template and the extraction; no entity or attribute names are hard-coded.                                                                                                                                                                                                 |
| III. Two-layer dependency model      | Pass                           | Shapes, accessors and hooks live in `navigator-data`; UI and form logic live in `features`; `ui` is unchanged and only supplies existing primitives and the existing **Extracted** tag.                                                                                                                                 |
| IV. Three-track delivery             | Pass                           | Code lands in `entity-item-create`, `search` and the shared `hal-forms` state, all already `x-stability: stable`. The action renders nothing without an extract service.                                                                                                                                                |
| V. Deny-by-default ABAC              | Pass                           | The action is gated on the extract home and the chosen template being present; relation values still go through the create form's own template on submit.                                                                                                                                                               |
| VI. Authentication                   | Pass                           | Extract requests use a dedicated `extractFetch` whose token is exchanged for the extract service origin, so the user's application token never leaves the API origin (research D10).                                                                                                                                    |
| VII. Supply chain                    | Pass                           | No dependency, lockfile or workflow changes.                                                                                                                                                                                                                                                                            |
| VIII. View-owned data loading        | Pass                           | The container owns `useExtractService` / `useExtractMetadata`; `applyExtraction` lives in `entity-item-create/util/`; apps are unchanged.                                                                                                                                                                               |
| IX. Spec traceability                | Pass                           | Every step below cites a story or FR; external code is linked by public permalink, not a local path.                                                                                                                                                                                                                    |

Re-check after Phase 1: still passes. The only URL the client builds is the token-exchange endpoint (Complexity Tracking); `ui` is unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/006-metadata-extraction/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    └── extract-service.md
```

### Source Code (repository root)

```text
packages/navigator-data/src/
├── shapes.tsx                                  # + Extraction shapes, ExtractServiceShape
├── api/requests.ts                             # + ExtractRequestSpec
├── api/client.ts, client.test.ts               # + createExtractClient (token exchange for non-API origins)
├── auth/use-app-auth.ts                        # build extractFetch; pass extractServiceUrl
├── hooks/context.tsx                           # + extractFetch, extractServiceUrl
├── query-keys.ts                               # + extractService
├── accessors/
│   ├── extract-service.ts                      # NEW: ExtractService
│   ├── extract-service.test.ts                 # NEW
│   ├── extraction.ts                           # NEW: Extraction, EntityExtraction, threshold
│   └── extraction.test.ts                      # NEW
├── hooks/extraction/
│   ├── use-extract-service.ts                  # NEW
│   └── use-extract-metadata.ts                 # NEW
├── hooks/index.ts, index.ts                    # exports
packages/navigator-data/test-fixtures/extraction/   # NEW: extract home + extraction recorded from the mock service

packages/features/src/hal-forms/state/
├── use-hal-forms-field-state.ts                # + suggestExternalValue
└── use-hal-forms-field-state.test.ts

packages/features/src/util/coerce-field-value.ts (+ test)   # moved from search/filter-properties.ts; search imports it

packages/features/src/entity-item-create/
├── util/apply-extraction.ts                    # NEW
├── util/apply-extraction.test.ts               # NEW
├── extraction/extract-metadata-action.tsx      # NEW: button + dialog
├── extraction/extract-metadata-action.test.tsx # NEW (MSW)
├── extraction/extraction-details.tsx           # NEW: popover body (value, confidence, reason, Apply; candidates)
├── extraction/extraction-report.tsx (+ test)    # NEW: report (US4)
├── extraction/possible-duplicates.tsx (+ test)  # NEW: duplicate warning (US5)
└── create-entity-item-container.tsx            # hold extraction; render action; clear on reset
```

**Structure Decision**: follows the existing split. Data in `navigator-data`, form logic and UI in `features`, `ui` unchanged, apps unchanged.

## Implementation Sequence (input for `/speckit-tasks`)

The work is delivered as stacked PRs. Each PR branches from the one before it and can be reviewed on its own.

**PR 1 – Spec**

1. This folder (`specs/006-metadata-extraction/`). No code.

**PR 2 – Data layer** (no visible change)

2. **Fixtures**: record the extract home and one extraction (with attributes, a to-one and a to-many relation, candidates) from the mock extract service; confirm the template `method` / `contentType`, the date and boolean value formats, and whether the mock service returns `candidate_search`. Add MSW handlers for the extract home, the extraction and the token-exchange endpoint. (contract)
3. **navigator-data**: shapes, `ExtractRequestSpec`, `Extraction` / `EntityExtraction` + tests. (US1, US3, FR-007)
4. **navigator-data**: `createExtractClient`, `extractFetch` / `extractServiceUrl` on the data context, `queryKeys.extractService` + client test. (FR-001, FR-010)
5. **navigator-data**: `ExtractService` + `useExtractService` + `useExtractMetadata` + tests. (US1, FR-001–FR-004)

**PR 3 – Fill and review attributes** (US1, US2)

6. **features**: move `coerceFilterValue` to `util/coerceFieldValue`; update `search`. (FR-011)
7. **features/hal-forms**: `suggestExternalValue` + test. (US2)
8. **features/entity-item-create**: `applyExtraction` for attributes + tests. (US1, FR-005, FR-006, FR-011)
9. **features/entity-item-create**: `ExtractionDetails` for attributes (value, confidence, reason, Apply). (US2)
10. **features/entity-item-create**: `ExtractMetadataAction` (button, dialog, options, error alert) wired into the container; discard; clear on reset + MSW test. (US1, FR-008, FR-009)

**PR 4 – Relations** (US3)

11. **features/entity-item-create**: `applyExtraction` auto-links relations from `getAutoLinkableRelations` + tests. (US3, FR-007)
12. **features/entity-item-create**: `ExtractionDetails` for relations: candidate list (fetched with `useEntityItemsByUrl`), pick and remove. (US3)

**PR 5 – Report and duplicate warning** (US4, US5)

13. **features/entity-item-create**: `ExtractionReport` and `PossibleDuplicates` next to the extract action + tests. (US4, US5, FR-012, FR-013)

**Every PR**

- **Review gate**: re-read `packages/navigator-data/CLAUDE.md`, `packages/features/CLAUDE.md` and `packages/ui/CLAUDE.md` against the diff; `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- If the code departs from this spec, update the spec in the same PR (constitution Principle IX).

## Dependencies

- The create form's `useHalFormsFieldState` / `resolveHalFormsFields` stack, its file field, and `setExternalValue` with its **Extracted** tag.
- The Create Item page's attached file (`004-create-item-page`) makes the file present on arrival, but extraction also works with a file dropped into the form's own file field.

## Complexity Tracking

| Item                                                                    | Why                                                                                                                                               | Simpler alternative rejected because                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Token-exchange URL built from the API origin plus a fixed platform path | The extract service must not receive the user's application token, and the platform's exchange endpoint is not published as a link (research Q4). | Sending `apiFetch`'s user token to the extract service would hand the application token to another origin. |
