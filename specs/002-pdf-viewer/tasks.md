# Tasks: PDF Viewer for Content Attributes

**Input**: Design documents from `/specs/002-pdf-viewer/`

**Prerequisites**: plan.md, spec.md, research.md (§8 decisions), data-model.md, contracts/, quickstart.md

**Tests**: Included. The spec's success criteria (SC-003…SC-008) and the constitution's quality gates
require MSW-backed hook tests, Storybook stories with visual + a11y coverage, a scripting-posture fixture
test and one e2e scenario.

**Organization**: Phase 1 setup, Phase 2 foundational (data layer + viewer pattern, blocking), then one
phase per user story in priority order, then polish. The frontend performs **no token exchange**:
rendition requests reuse `contentFetch` (spec FR-023, research §8.3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (view a stored PDF), US2 (rendition-backed preview), US3 (search and print)
- Every task names the exact file(s) it touches

## Path Conventions

pnpm monorepo: `packages/navigator-data/src/**`, `packages/ui/src/**`, `packages/features/src/**`,
`apps/navigator-experimental/src/**`, `apps/navigator/tests/e2e/**`, `docs/adr/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: decisions on record, dependencies and fixtures in place before any viewer code.

- [x] T001 Amend `docs/adr/ADR-011-pdf-stack-embedpdf-fallback.md`: decision becomes headless `@embedpdf/core` + individual plugins (not the drop-in `react-pdf-viewer`); record that EmbedPDF renders with PDFium/WASM (not pdf.js) so the CVE-2024-4367 posture becomes "document scripting disabled in the engine, proven by fixture"; current versions (`@embedpdf` 2.15.x, `pdfjs-dist` 6.x, `@react-pdf-viewer` unmaintained since 2023); self-hosted `pdfium.wasm`, `blob:` worker → CSP `worker-src blob:`, font fallback disabled; annotation-related trigger conditions stay for the follow-up story. Update `docs/adr/README.md` index line and the ADR status/date. No viewer code lands before this task is merged.
- [x] T002 [P] Add pinned runtime dependencies to `packages/ui/package.json`: `@embedpdf/core`, `@embedpdf/engines`, `@embedpdf/pdfium`, `@embedpdf/models`, `@embedpdf/plugin-document-manager`, `@embedpdf/plugin-viewport`, `@embedpdf/plugin-scroll`, `@embedpdf/plugin-render`, `@embedpdf/plugin-zoom`, `@embedpdf/plugin-search`, `@embedpdf/plugin-print`, `@embedpdf/plugin-selection`, `@embedpdf/plugin-interaction-manager` — all the same exact version, the newest published ≥ 14 days before install day (2.15.0 from 2026-08-04 qualifies on 2026-09-17); run `pnpm install` (lockfile changes are CODEOWNERS-reviewed); confirm none has an install script (`pnpm why`/registry) so `onlyBuiltDependencies` stays empty.
- [x] T003 [P] Create PDF fixtures as committed binaries: `packages/navigator-data/test-fixtures/pdf/minimal.pdf` (1 page, "Hello"), `packages/navigator-data/test-fixtures/pdf/js-in-pdf.pdf` (1 page with `/OpenAction << /S /JavaScript /JS (app.alert('x')) >>`), copies of both under `packages/ui/src/patterns/pdf-viewer/fixtures/`, and `apps/navigator/tests/e2e/fixtures/twenty-pages.pdf` (20 pages, ≤ 5 MB, numbered pages) for SC-001; add `**/fixtures/**` to `sonar.coverage.exclusions` in `sonar-project.properties` only if Sonar starts scanning them.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the data layer that turns a content attribute into displayable PDF bytes, and the viewer
pattern that displays bytes. Two independent tracks (2A navigator-data, 2B ui) that can run in parallel.

**⚠️ CRITICAL**: no user-story work starts until T005–T020 are complete.

### 2A — `@contentgrid/navigator-data`

- [x] T004 [P] Implement `packages/navigator-data/src/preview/content-mimetype.ts`: `isPdfMimetype(mimetype)` (strip parameters after `;`, trim, case-insensitive equals `application/pdf`; `null`/`undefined` → false) and `needsRendition(mimetype)` (`!isPdfMimetype`; missing or `application/octet-stream`/`binary/octet-stream` → true); tests in `content-mimetype.test.ts`.
- [x] T005 [P] Add `RENDITION_INVALID_CONVERSION = "https://contentgrid.cloud/problems/renditions/invalid-conversion"` to `packages/navigator-data/src/api/problem-details/constants.ts` (and the `ContentGridProblemType` union/`toProblemDisplayModel` stays `kind: "unknown"` for it); test that `isProblemOfType(err, RENDITION_INVALID_CONVERSION)` narrows a MSW-served problem in `packages/navigator-data/src/api/problem-details/guards.test.ts`.
- [x] T006 [P] Extend `packages/navigator-data/src/auth/auth-config.ts`: `RuntimeAppConfig` gains `renditionPollIntervalMs?: number` and `renditionTimeoutMs?: number`; `ContentGridConfigSchema` (Liaison `config.js`) accepts optional `v1.renditionUri`, `v1.renditionPollIntervalMs`, `v1.renditionTimeoutMs`; `DevConfigOverrideSchema` and `loadAppConfig()` read them with env fallback `VITE_RENDITION_URI`; validate `renditionUri` contains `{?url}`, interval ≥ 250, timeout ≥ interval (invalid → warn and ignore the value); tests in `auth-config.test.ts`.
- [x] T007 [P] Add MSW factories to `packages/navigator-data/test-fixtures/msw/handlers.ts`: `createRenditionHandlers({ requestUrl, jobUrl, pendingPolls, outcome: "ready" | "invalid-conversion" | "error" | "never", pdfBytes })` returning the initial `202 + Location` (or `200` when `pendingPolls === 0 && outcome === "ready"`), then `202` × `pendingPolls`, then the outcome; bodies as `Uint8Array`, never `new Response(blob)`; tests in `handlers.test.ts`.
- [x] T008 Implement `packages/navigator-data/src/preview/rendition-job.ts`: `requestRendition(fetch: TypedFetch, uriTemplate: string, contentHref: string, { signal, intervalMs, timeoutMs })` per `contracts/rendition-service.md` and data-model "RenditionJob" (expand `{?url}` with `@contentgrid/uri-template`, `202`+`Location` → poll first then wait `intervalMs`, `200` → `{ kind: "ready", bytes }`, problem `RENDITION_INVALID_CONVERSION` → `{ kind: "unsupported" }`, other → `RenditionProtocolError`/`ProblemDetailError`, `now ≥ deadline` → `RenditionTimeoutError`, abort → `AbortError`); tests in `rendition-job.test.ts` with `vi.useFakeTimers()` covering all branches (depends on T005, T007).
- [x] T009 Add `contentPreview: { byUrl: (href: string, etag: string | null) => ["ContentPreview", href, etag] as const }` to `packages/navigator-data/src/query-keys.ts`; test prefix behaviour in `query-keys.test.ts`.
- [x] T010 Extend `packages/navigator-data/src/hooks/context.tsx` (`NavigatorDataContextValue` + `renditionUri?: string`, `renditionPolling?: { intervalMs: number; timeoutMs: number }`), thread them from `RuntimeAppConfig` through `packages/navigator-data/src/auth/use-app-auth.ts` and the provider, and extend `makeWrapper(queryClient?, apiFetch?, contentFetch?, renditionUri?)` in `packages/navigator-data/src/hooks/test-utils.tsx` (depends on T006).
- [x] T011 Implement `packages/navigator-data/src/hooks/preview/use-content-preview.ts` per `contracts/content-preview-hooks.md`: `useContentPreview(entityItem, attributeName, { enabled? })` → `UseQueryResult<PreviewSource>`; throws if the attribute is not a content attribute; `queryFn({ signal })`: metadata `null` → `noFile`; PDF → `contentFetch(entityItem.downloadContentRequest(name))` → `404` → `noFile`, else bytes → `{ kind: "pdf", origin: "stored" }`; non-PDF with `renditionUri` → `requestRendition(contentFetch, …)` → `pdf/rendition` or `unsupported`; non-PDF without → `unavailable`; `retry: false`, `staleTime: Infinity`, `gcTime: 300_000`; export `PreviewSource` (depends on T004, T008, T009, T010).
- [x] T012 Tests `packages/navigator-data/src/hooks/preview/use-content-preview.test.tsx` using `makeWrapper`, `loadDumpProfile` (recorded profile with a content attribute) and the T007 handlers: stored PDF, 404 → `noFile`, `null` metadata → `noFile` without request, rendition ready, `invalid-conversion` → `unsupported`, no `renditionUri` → `unavailable`, `never` → `RenditionTimeoutError` after ceiling, 500 → error, key change aborts polling (assert no further handler calls), ETag change → new key, `contentFetch` used and `apiFetch` never (depends on T011).
- [x] T013 Export the new module from `packages/navigator-data/src/index.ts` and `src/hooks/index.ts` (`useContentPreview`, `PreviewSource`, `requestRendition`, `RenditionTimeoutError`, `RenditionProtocolError`, `isPdfMimetype`, `needsRendition`, `RENDITION_INVALID_CONVERSION`); add a "Content preview and renditions" section to `packages/navigator-data/CLAUDE.md` (query key family, `contentFetch` reuse, no exchange in the frontend) (depends on T011).

### 2B — `@contentgrid/ui` viewer pattern

- [x] T014 [P] Implement `packages/ui/src/patterns/pdf-viewer/pdf-engine-provider.tsx`: `PdfEngineProvider({ wasmUrl, children })` wrapping `usePdfiumEngine({ wasmUrl, worker: true })` with a Strict-Mode double-invoke guard (upstream #700), `fontFallback: { fonts: {} }` (no CDN), engine-init failure surfaced through context as `{ status: "error" }` (upstream #632 swallows it); unit test with the engine module mocked (depends on T002).
- [x] T015 Implement `packages/ui/src/patterns/pdf-viewer/use-pdf-viewer-state.ts`: glue over `useScroll`, `useZoom`, `useDocumentManagerCapability` → `documentState: idle|opening|ready|protected|invalid`, `page { current, total }` (mount page controls only after `onDocumentOpened`, upstream #691), `zoom { mode: fit-width|fit-page|custom, level }` with presets 25/50/75/100/125/150/200/300/400, native Fullscreen API toggle that preserves the zoom mode, `openDocumentBuffer({ arrayBuffer, name })` on `bytes` change with close-after-open guard (upstream #754) (depends on T014).
- [x] T016 Implement `packages/ui/src/patterns/pdf-viewer/pdf-viewer-toolbar.tsx` with `Button`, `Tooltip`, `DropdownMenu`, `Input` primitives and Phosphor `*Icon` exports, in mockup order: `start` slot · previous · "current / total" (editable, Enter jumps) · next · zoom out · level · zoom in · zoom menu · spacer · (search, print placeholders wired in US3) · download (when `onDownload`) · fullscreen · `end` slot; all controls `aria-label`led, disabled until `ready`; `aria-live="polite"` region announcing page and zoom changes (depends on T015).
- [x] T017 Implement `packages/ui/src/patterns/pdf-viewer/pdf-viewer.tsx` per `contracts/pdf-viewer-pattern.md` (`PdfViewerProps`, `PdfViewerToolbarOptions`, `PdfViewerLabels`, `PdfViewerErrorBoundary`), composing `EmbedPDF` provider + `plugin-document-manager`, `plugin-viewport`, `plugin-scroll`, `plugin-render`, `plugin-zoom`, `plugin-selection` (+ `plugin-interaction-manager`), a `SelectionLayer` for text copy, `onLoadError({ kind: "invalid" | "protected" | "engine" })`, `onDocumentOpened({ pageCount })`; export from `packages/ui/src/patterns/pdf-viewer/index.ts` and the package barrel (depends on T016).
- [x] T018 Stories `packages/ui/src/patterns/pdf-viewer/pdf-viewer.stories.tsx` loading `fixtures/minimal.pdf` via `?url` import and `fixtures/js-in-pdf.pdf`: `Default`, `ToolbarMinimal`, `Protected` (encrypted fixture or mocked `protected` state), `Invalid` (garbage bytes), `EngineFailure` (bad `wasmUrl`), `JsInPdf` whose `play()` fails on any `dialog`/`alert` (FR-026/SC-005); `play()` per control (next/previous/jump/zoom/fullscreen/download) (depends on T017, T003).
- [x] T019 Unit tests `packages/ui/src/patterns/pdf-viewer/pdf-viewer.test.tsx` with plugin hooks mocked: toolbar state transitions, disabled states, page jump validation, zoom preset stepping, fullscreen zoom-mode preservation, error boundary fallback (depends on T017).
- [x] T020 Document the pattern in `packages/ui/CLAUDE.md` (pattern list entry; `wasmUrl` must be absolute and self-hosted; CSP `worker-src blob:`; no CDN) and generate visual baselines for the new stories in the pinned Linux Playwright image (`pnpm test:visual:update`) (depends on T018).

**Checkpoint**: `pnpm -r typecheck`, `pnpm test`, `pnpm test:storybook` green; a PDF renders in Storybook from local bytes with no external network request.

---

## Phase 3: User Story 1 — View a PDF stored on an entity item (Priority: P1) 🎯 MVP

**Goal**: content-focus layout with the viewer on the left and attributes/relations on the right; page
navigation, zoom, attribute selector, download, fullscreen; all empty/error states.

**Independent Test**: open a fixture item with a PDF in `apps/navigator-experimental` → page 1, "1 / N",
next/previous/zoom work, download delivers the original, fullscreen toggles; item without a file → "No
file" with drop zone; entity without content attribute → attribute-focus layout.

### Implementation for User Story 1

- [x] T021 [US1] Scaffold the feature: `packages/features/src/entity-item-content-focus/package.json` (`{"name":"@contentgrid/features-entity-item-content-focus","version":"0.0.1","x-stability":"experimental","private":true}`), `index.ts`, and the subpath export `"./entity-item-content-focus"` in `packages/features/package.json`; add `packages/features/src/entity-item-content-focus/CLAUDE.md` (scope, promotion path from plan §Structure Decision).
- [x] T022 [P] [US1] Implement `packages/features/src/entity-item-content-focus/util/pdfium-wasm-url.ts`: `import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url"` (note: **not** `.../dist/pdfium.wasm?url` — the package's `exports` map only publishes the `./pdfium.wasm` subpath, even though that's not the file's on-disk location; the `dist/...` path fails Vite/Rolldown's `exports`-conditions resolution, see `packages/ui/CLAUDE.md`) → `export const pdfiumWasmUrl = new URL(wasmUrl, window.location.href).href` (absolute, upstream #633); declare the `*.wasm?url` module in `packages/features/src/vite-env.d.ts` if not covered by `vite/client`.
- [x] T023 [P] [US1] Implement `packages/features/src/entity-item-content-focus/util/select-default-content-attribute.ts`: `selectDefaultContentAttribute(profileEntity, entityItem)` → first content attribute in profile order whose metadata is non-null, else the first content attribute; pure; tests in `select-default-content-attribute.test.ts` using `loadDumpProfile`.
- [x] T024 [P] [US1] Implement `packages/features/src/entity-item-content-focus/components/content-focus-layout.tsx`: CSS grid `1fr 360px`, side panel collapsible (toggle in panel header), fills the available height without nested scrollbars (`min-h-0`, `overflow` per region), exposes `ref` for the fullscreen host; story `content-focus-layout.stories.tsx` at large and small viewports (stacks below 800 px).
- [x] T025 [P] [US1] Implement `packages/features/src/entity-item-content-focus/components/content-attribute-selector.tsx`: `Select` of content attributes that hold a file (label = attribute title/name, `PaperclipIcon`), hidden when only one; rendered in the viewer toolbar `start` slot.
- [x] T026 [US1] Implement presentational `packages/features/src/entity-item-content-focus/components/content-preview-frame.tsx`: `state` prop = data-model "Content preview panel state" (`noFile` renders `FileUploadZone` from `@contentgrid/ui` with a no-op `onFileChange`, `loading`/`preparingPreview` skeleton + caption, `ready` renders children, `previewUnavailable`/`couldNotPrepare`/`couldNotRetrieve`/`cannotDisplay`/`protected`/`viewerFailure` render `ProblemAlert` (generic kind) or a message with Download and, where the table says so, Retry); stories `content-preview-frame.stories.tsx` with one story per state (SC-006) (depends on T021).
- [x] T027 [US1] Implement `packages/features/src/entity-item-content-focus/components/content-preview-panel.tsx`: props `{ entityItem, attributeName }`; `useContentPreview` + `useDownloadContent`; `React.lazy` import of `PdfViewer` wrapped in `PdfViewerErrorBoundary` and `PdfEngineProvider({ wasmUrl: pdfiumWasmUrl })`; maps query status × `PreviewSource` × viewer callbacks to the frame state; Download → mutation → object URL `<a download={filename}>` click → revoke; Retry → `refetch()`; "converted preview" badge when `origin === "rendition"`; tests `content-preview-panel.test.tsx` with `makeWrapper` + T007 handlers and the viewer mocked (depends on T022, T026, Phase 2).
- [x] T028 [US1] Implement `packages/features/src/entity-item-content-focus/views/entity-item-content-focus-view.tsx` per `contracts/content-focus-view.md`: props `entityName`, `itemId`, `toolbar?`, relation callbacks; `useProfileEntity({ name })` + `useEntityItem`; FR-001 via `profileEntity.hasContentAttributes` (false → existing `EntityItemView` body); content-focus → `ContentFocusLayout` with `ContentPreviewPanel` + `ContentAttributeSelector` (toolbar `start` slot) on the left and `EntityItemAttributes` + `RelationToOneSection`/`RelationToManySection` in the side panel; default breadcrumbs from profile/item; tests `entity-item-content-focus-view.test.tsx` (layout branch, default attribute, selector switching resets panel) (depends on T023, T024, T025, T027).
- [x] T029 [US1] Wire `apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx` to mount `EntityItemContentFocusView` with `entityName`, `itemId`, breadcrumbs and the existing navigation callbacks (keep `RelationProblemDialog`); verify `apps/navigator-experimental/vite.config.ts` needs no `optimizeDeps`/asset change for the `?url` wasm import (add `optimizeDeps.exclude: ["@embedpdf/engines"]` only if the dev server fails); add `VITE_RENDITION_URI=` placeholder comment to `apps/navigator-experimental/.env.development`; MSW dev handler serving `minimal.pdf` bytes for a fixture content link in `apps/navigator-experimental/src/mocks/` (depends on T028).
- [x] T030 [US1] Playwright e2e `apps/navigator/tests/e2e/content-focus.spec.ts` (or the experimental app's e2e project if the generic app does not mount the feature): log in, open the fixture item with `fixtures/twenty-pages.pdf`, assert viewer, "1 / 20", next → "2 / 20", zoom, download filename, attribute panel visible; runs in all four Playwright projects (depends on T029, T003). — note: the e2e spec is in place and skipped by default; running it against the dev fixtures is blocked by a pre-existing crash on `main` (invoice demo fixture without attributes, see quickstart.md "End-to-end"), not by this feature.

**Checkpoint**: US1 independently testable; quickstart steps 1–6, 11, 12 pass.

---

## Phase 4: User Story 2 — Preview a non-PDF file through its PDF rendition (Priority: P2)

**Goal**: Office files shown as PDF via the rendition service with pending, unsupported, timeout and
error states; Download stays the original; polling bounded and cancellable.

**Independent Test**: with the MSW rendition handlers in modes `ready`, `invalid-conversion`, `never`,
`error`, open a `.docx` fixture item: PDF after "Preparing preview"; "Preview not available"; failure
after the ceiling with Retry; polling stops on navigation.

### Implementation for User Story 2

- [x] T031 [US2] Add rendition dev handlers `apps/navigator-experimental/src/mocks/rendition-handlers.ts` (reuse `createRenditionHandlers` from `packages/navigator-data/test-fixtures/msw/handlers.ts`; mode switch via `localStorage["contentgrid-navigator:dev-rendition-mode"]`), a fixture `.docx` content item, and `VITE_RENDITION_URI` in `apps/navigator-experimental/.env.development` pointing at the mocked template.
- [x] T032 [US2] Complete `content-preview-panel.tsx` rendition states: `preparingPreview` caption "Preparing preview" (Download enabled), `previewUnavailable` for `unavailable`/`unsupported` with the mimetype, `couldNotPrepare` for `RenditionTimeoutError`/rendition failures with Retry, converted-preview indicator, print uses the displayed rendition; ensure no stale document renders during the wait (FR-006); extend `content-preview-panel.test.tsx` for each mode and for abort on attribute switch (FR-021) (depends on T027, T031).
- [x] T033 [P] [US2] Add rendition-state stories to `content-preview-frame.stories.tsx` (`PreparingPreview`, `PreviewUnavailableRendition`, `CouldNotPrepare`) and visual baselines (depends on T026).
- [x] T034 [P] [US2] Document deployment requirements in `packages/features/src/entity-item-content-focus/CLAUDE.md` and `docs/adr/ADR-011-…` consequences: CSP `worker-src blob:`, `connect-src` must include the rendition origin, the rendition service must allow the Navigator origin with `Authorization` and expose `Location`; Liaison must deliver `v1.renditionUri`; open confirmations with the platform team (ACC-2960).

**Checkpoint**: quickstart steps 7, 8 and the "Rendition failure paths" section pass.

---

## Phase 5: User Story 3 — Find text and print (Priority: P3)

**Goal**: in-document search with count/position, previous/next, Enter/Shift+Enter, match-case and
whole-word; print of the displayed document; full keyboard operability and announcements.

**Independent Test**: on `twenty-pages.pdf` search a term occurring on several pages: "1 of n", step,
toggles, clear; print opens the browser dialog; all controls operable by keyboard with zero a11y violations.

### Implementation for User Story 3

- [x] T035 [US3] Add search to the viewer: `plugin-search` registration in `pdf-viewer.tsx`, `useSearch` glue in `use-pdf-viewer-state.ts` (`query`, `total`, `activeIndex`, `matchCase`, `wholeWord`, `open`; confirm the `MatchFlag` members from `@embedpdf/models` and map the two toggles), `SearchLayer` for highlight boxes styled distinctly from selection, search `Popover` in `pdf-viewer-toolbar.tsx` with `Input`, "n of m", previous/next, Enter/Shift+Enter, `Switch` toggles, clear; announce position via the live region (depends on Phase 2B).
- [x] T036 [US3] Add print: `plugin-print` registration and `usePrint` in `pdf-viewer.tsx`/`use-pdf-viewer-state.ts`; toolbar Print button calls `print()` for the displayed document (native `window.print()` via the plugin's hidden frame); disabled until `ready` (depends on Phase 2B).
- [x] T037 [US3] Stories `SearchOpen`, `SearchNoResults`, `PrintReady` in `pdf-viewer.stories.tsx` with `play()` covering typing, Enter/Shift+Enter, toggles and clear; keyboard-only `play()` traversing every toolbar control; run `pnpm test:a11y` and fix any violation (SC-003) (depends on T035, T036).
- [x] T038 [US3] Extend `pdf-viewer.test.tsx` for search state (count/position, wrap-around, toggles reset results, clear removes emphasis) and print enable/disable (depends on T035, T036).

**Checkpoint**: quickstart steps 9 and 10 pass; a11y suite green.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T039 [P] Update `packages/navigator-data/CLAUDE.md` (done in T013, verify), `packages/ui/CLAUDE.md` (T020, verify), `packages/features/CLAUDE.md` (new feature listed, promotion checklist: move the FR-001 branch into `entity-item`'s `EntityItemView`, flip `apps/navigator` route, delete wrapper) and `AGENTS.md` if the package list changed.
- [x] T040 [P] Performance sanity per quickstart: cold-cache first page ≤ 3 s on 20 Mbit/s for `twenty-pages.pdf` (record wasm vs document transfer), page/zoom ≤ 200 ms on a 200-page document; note results in `specs/002-pdf-viewer/quickstart.md` under "Performance sanity" (SC-001, SC-002).
- [x] T041 Run the full validation: `pnpm -r typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm test:storybook`, `pnpm test:visual`, `pnpm test:a11y`, e2e; SonarCloud new-code coverage ≥ 80 % (add tests where the gate fails; never exclude feature code). — note: the e2e spec is in place and skipped by default; running it against the dev fixtures is blocked by a pre-existing crash on `main` (invoice demo fixture without attributes, see quickstart.md "End-to-end"), not by this feature.
- [x] T042 Independent fresh-context review per `AGENTS.md` (data-layer changes also through the `contentgrid-data-reviewer` agent); record with `scripts/navigator-review.sh record <VERDICT>`; open the implementation PR(s) stacked on `002-pdf-viewer`; list the open platform confirmations (ACC-2960, Liaison `renditionUri`, CORS, ACC-2902 ownership) in the PR body.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (decision on record); T002 and T003 parallel with it.
- **Foundational (Phase 2)**: 2A needs T003 (fixtures) and T005/T007 before T008; 2B needs T002 and T003. 2A and 2B run in parallel. Blocks all user stories.
- **US1 (Phase 3)**: needs all of Phase 2; T021 first (scaffold), then T022–T025 in parallel, then T026 → T027 → T028 → T029 → T030.
- **US2 (Phase 4)**: needs US1's panel (T027) and the data layer; T031 first, T032 after; T033/T034 parallel.
- **US3 (Phase 5)**: needs Phase 2B only; can run in parallel with US1/US2 by another agent (touches `packages/ui` files that US1 does not).
- **Polish (Phase 6)**: after the stories you intend to ship.

### User Story Dependencies

- **US1**: independent once Phase 2 is done. MVP.
- **US2**: extends US1's panel; the data-layer path exists since T011, so it is small.
- **US3**: independent of US1/US2 (viewer pattern only); its results appear in US1's page automatically.

### Parallel Opportunities

- T002 ∥ T003 ∥ T001.
- Phase 2A (T004–T013) ∥ Phase 2B (T014–T020); inside 2A: T004 ∥ T005 ∥ T006 ∥ T007.
- US1: T022 ∥ T023 ∥ T024 ∥ T025 after T021.
- US2: T033 ∥ T034 with T032.
- US3 as a whole ∥ US1/US2.

---

## Parallel Example: Phase 2

```bash
# Agent A (navigator-data): T004, T005, T006, T007 in parallel, then T008 → T009 → T010 → T011 → T012 → T013
# Agent B (ui):             T014 → T015 → T016 → T017 → T018 → T019 → T020
```

## Parallel Example: User Story 1

```bash
Task: "T022 pdfium-wasm-url.ts"
Task: "T023 select-default-content-attribute.ts + test"
Task: "T024 content-focus-layout.tsx + story"
Task: "T025 content-attribute-selector.tsx"
# then T026 → T027 → T028 → T029 → T030
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (ADR-011, deps, fixtures) → Phase 2 (data layer ∥ viewer pattern).
2. Phase 3: US1 → validate with quickstart steps 1–6, 11, 12 → demo in `apps/navigator-experimental`.

### Incremental Delivery

1. - US2 (rendition) → quickstart 7–8 and failure paths → demo.
2. - US3 (search/print) → quickstart 9–10, a11y → demo.
3. Polish, full validation, review, PR; promotion to `apps/navigator` is a later, separate change.

---

## Notes

- Every mutation of `packages/*` follows the package `CLAUDE.md`; never `useQuery` outside `navigator-data`; never hand-build URLs; `contentFetch` for bytes and renditions, never `apiFetch`.
- Dependencies: exact versions, ≥ 14 days old, no build scripts, lockfile committed.
- Reviews: an edit set is complete → independent review → receipt, before commit.
- Commit per task group; stop at each checkpoint and validate the story independently.
