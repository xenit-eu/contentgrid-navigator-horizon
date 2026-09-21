# Implementation Plan: PDF Viewer for Content Attributes

**Branch**: `002-pdf-viewer` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-pdf-viewer/spec.md`

## Summary

Add a content-focus detail view that renders a content attribute's PDF next to the item's
attributes and relations, with the production toolbar (attribute selector, page navigation, zoom,
search, print, download, fullscreen), and shows non-PDF files through the platform's PDF rendition
(asynchronous job, bounded polling, "cannot convert" fallback). Technical approach: a headless
`@embedpdf/core` + plugin viewer with a shadcn toolbar as a `@contentgrid/ui` pattern (self-hosted
PDFium WASM, no CDN); a `useContentPreview` query hook in `@contentgrid/navigator-data` that turns an
entity item's content attribute into displayable PDF bytes (stored PDF or rendition); rendition
requests made with the existing authenticated content client (TokenMonger handles any exchange on the
platform side); and a
new experimental feature `entity-item-content-focus` that composes the existing stable `entity-item`
attributes and relations into the mockup's two-pane layout, mounted first by
`apps/navigator-experimental`. Everything is tested with Vitest + MSW (hooks, state machine), Storybook
stories with Playwright visual/a11y snapshots (every state), and one Playwright end-to-end scenario.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19.1 (shared packages keep the `^18 || ^19` peer range)

**Primary Dependencies**: `@embedpdf/core`, `@embedpdf/engines`, `@embedpdf/pdfium`, `@embedpdf/models`,
`@embedpdf/plugin-{document-manager,viewport,scroll,render,zoom,search,print,selection,interaction-manager}`
at **2.15.0** (2.15.1 is 1 day old; pin whichever line is ≥ 14 days old on install day, all packages
share one version; no lifecycle scripts, React 19 allowed); TanStack Query 5, TanStack Router 1.170, Vite 8, `@contentgrid/ui`
shadcn primitives, `@phosphor-icons/react` 2.1.10

**Storage**: N/A (browser memory only: object URLs / `ArrayBuffer` per displayed document, TanStack
Query cache for the preview source, no localStorage)

**Testing**: Vitest 4.1 + React Testing Library + MSW 2.14 (hooks, rendition state machine, mimetype util); Storybook 10.4 stories with `play()` + Playwright visual and a11y snapshots
(viewer pattern, every FR-024 state); Playwright e2e in `apps/navigator/tests/e2e` (one content-focus
scenario with `fixtures/Bob.pdf`); a fixture PDF with embedded JavaScript rendered in a browser story
test for FR-026

**Target Platform**: Modern evergreen browsers (WebAssembly + module Web Workers); Node 20+ / pnpm
11.5.2 for development and CI

**Project Type**: pnpm monorepo, reusable UI / data / feature packages + two React SPAs

**Performance Goals**: first page visible ≤ 3 s for a 20-page ≤ 5 MB PDF on ≥ 20 Mbit/s (SC-001);
page/zoom changes ≤ 200 ms up to 200 pages (SC-002); PDFium WASM (~4.4 MB) loaded once per session
and cached as an immutable hashed asset, fetched only on content-focus pages (lazy chunk)

**Constraints**: no runtime asset from a third-party CDN and document bytes never leave the browser
except towards the platform (FR-027) → self-hosted `pdfium.wasm`, font fallback disabled; the engine
worker is a `blob:` module worker → CSP needs `worker-src blob:`; the rendition service is another
origin → CSP `connect-src` must list it and the service must allow the Navigator origin with an
`Authorization` header; scripting in PDFs disabled and proven by fixture (FR-026); dependency rules
(exact pins, 14-day `minimumReleaseAge`, no build scripts — verified none needed); `@contentgrid/ui` stays
free of Navigator data types (Principle III, spec-001 `ui-standalone` contract); new views take
identifiers and callbacks only (Principle VIII)

**Scale/Scope**: one new view, one new UI pattern (viewer + toolbar), one new layout, three new
navigator-data hooks/factories, one query-key family, one problem type, config plumbing for the rendition
endpoint; ~9 stories, ~40 unit tests, 1 e2e scenario

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / section                               | How this plan complies                                                                                                                                                                                                                                                                                                                                      | Status |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. HAL is the only interaction model              | File bytes come only from the item's `cg:content` link through the existing `entityItem.downloadContentRequest` exception. The rendition service is identified by that link's href as an opaque `url` value of a configured URI template (no path building). No `_templates` exist for renditions; the service is not a HAL resource.                       | PASS   |
| II. Model-first                                   | Content attributes discovered via `ProfileAttribute.isContent` and the existing `ProfileEntity.hasContentAttributes` getter (FR-001); presence/mimetype/filename from `ContentMetadata`; no attribute names assumed.                                                                                                                                        | PASS   |
| III. Two-layer model & package boundaries         | `@embedpdf/*` are plain runtime `dependencies` of `@contentgrid/ui` (presentation libs). The viewer pattern takes `ArrayBuffer`/strings/callbacks only. Data hooks, rendition client, mimetype util and problem type live in `navigator-data`. Features import neither Layer-1 nor apps.                                                                    | PASS   |
| IV. Three-track delivery                          | New feature dir `packages/features/src/entity-item-content-focus/` with `x-stability: experimental`; consumed by `apps/navigator-experimental` only; imports the stable `entity-item` (allowed direction). Promotion path documented (fold into `EntityItemView`).                                                                                          | PASS   |
| V. Deny-by-default ABAC                           | Per review: the content link is present for any readable item; 404 on it = no file. 403/404 on the item itself are handled by the existing item gate. No capability inferred client-side.                                                                                                                                                                   | PASS   |
| VI. Authentication & tokens                       | Rendition requests use the same Bearer credential as content downloads (`contentFetch`), sent only in the `Authorization` header. The frontend performs no token exchange and hardcodes or discovers no token endpoint; TokenMonger does the exchange for the rendition service on the platform side.                                                       | PASS   |
| VII. Supply chain                                 | Exact pins ≥ 14 days old; `@embedpdf/*` have no install scripts (verified) → no `onlyBuiltDependencies` change; WASM shipped as a committed npm asset, copied by Vite; no CDN.                                                                                                                                                                              | PASS   |
| VIII. View-owned data loading / app-view contract | `EntityItemContentFocusView` takes `entityName`, `itemId` and callbacks; resolves profile and item through `navigator-data` hooks; the app route only picks view and layout; the preview panel is an independently loading component (skeleton/error/empty per region) under the existing app-level profile gate; transformations in the feature's `util/`. | PASS   |
| Error handling & API contracts                    | Rendition and download failures surface as `ProblemDetailError` via `problemDetailsHook`; narrowing with `isProblemOfType`/`isProblemWithStatus`; the new `RENDITION_INVALID_CONVERSION` type is a typed member; user-facing errors rendered through `toProblemDisplayModel` + `ProblemAlert` (generic kind), not a bespoke alert.                          | PASS   |
| Development workflow & quality gates              | MSW handlers for every new hook; stories for the pattern and every state with visual + a11y coverage; browser validation per `quickstart.md`; independent review gate before commits; 80 % new-code coverage.                                                                                                                                               | PASS   |

**Re-check after Phase 1 design**: unchanged. The design added no store, no Layer-1 import outside `navigator-data`,
and no second whole-page gate (the preview panel gates only its own region).

## Project Structure

### Documentation (this feature)

```text
specs/002-pdf-viewer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command) — §8 "Plan-phase decisions"
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── content-preview-hooks.md
│   ├── pdf-viewer-pattern.md
│   ├── rendition-service.md
│   └── content-focus-view.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/navigator-data/src/
├── api/
│   └── problem-details/constants.ts       # + RENDITION_INVALID_CONVERSION
├── auth/auth-config.ts                    # + renditionPollIntervalMs, renditionTimeoutMs;
│                                          #   ContentGridConfigSchema reads v1.renditionUri (Liaison)
├── hooks/context.tsx                      # NavigatorDataContextValue + renditionUri?, renditionPolling?
├── preview/
│   ├── content-mimetype.ts                # isPdfMimetype(), needsRendition() (parameters, case)
│   ├── rendition-job.ts                   # requestRendition(): 202+Location, poll, ceiling, AbortSignal
│   └── index.ts
├── hooks/preview/
│   ├── use-content-preview.ts             # useContentPreview(entityItem, attributeName) → PreviewSource
│   └── use-content-preview.test.tsx
├── query-keys.ts                          # + contentPreview.byUrl(href, etag)
└── test-fixtures/
    ├── msw/handlers.ts                    # + createRenditionHandlers({ pendingPolls, outcome })
    └── pdf/{minimal.pdf, js-in-pdf.pdf}   # tiny fixtures (bytes served as Uint8Array)

packages/ui/src/patterns/pdf-viewer/
├── pdf-viewer.tsx                         # <PdfViewer bytes filename wasmUrl toolbar… /> (headless core + plugins)
├── pdf-viewer-toolbar.tsx                 # shadcn Button/Tooltip/DropdownMenu/Popover/Input, Phosphor *Icon
├── pdf-engine-provider.tsx                # usePdfiumEngine({ wasmUrl, worker: true }), fontFallback off
├── use-pdf-viewer-state.ts                # page, zoom mode, search, fullscreen glue over plugin hooks
├── pdf-viewer.stories.tsx                 # states + play() for every toolbar control; js-in-pdf story
├── pdf-viewer.test.tsx                    # toolbar logic with the engine mocked
└── index.ts

packages/features/src/entity-item-content-focus/     # x-stability: experimental
├── package.json
├── index.ts
├── views/entity-item-content-focus-view.tsx         # entityName + itemId + callbacks; FR-001 branch
├── components/
│   ├── content-focus-layout.tsx                     # 1fr / 360px grid, side panel collapse, fullscreen host
│   ├── content-attribute-selector.tsx               # FR-004
│   ├── content-preview-panel.tsx                    # owns useContentPreview + useDownloadContent; lazy PdfViewer
│   ├── content-preview-frame.tsx                    # presentational: PreviewSource state → UI (FR-024)
│   └── content-preview-frame.stories.tsx            # one story per state (SC-006)
├── util/
│   ├── select-default-content-attribute.ts          # profile order, first with a file
│   └── pdfium-wasm-url.ts                           # `?url` import → absolute URL
└── *.test.tsx

apps/navigator-experimental/src/routes/_app/$entity/$itemId.tsx   # mounts EntityItemContentFocusView
apps/navigator-experimental/vite.config.ts                        # optimizeDeps/asset checks if needed
docs/adr/ADR-011-pdf-stack-embedpdf-fallback.md                   # amendment (headless, PDFium, versions)
```

**Structure Decision**: keep the three-package split. Data access and the rendition protocol belong to `navigator-data` (HAL, TanStack Query, credentials). The viewer is a
`@contentgrid/ui` pattern because it is reused by the follow-up annotation story and the create flow's
local-file preview, and because it must stay free of Navigator data types (it takes bytes and
callbacks). The content-focus view is a new experimental feature rather than a change to the stable
`entity-item`, because a stable feature may not import experimental code; it reuses `entity-item`'s
attribute and relation components, and promotion means moving the FR-001 branch into `EntityItemView`
and deleting the wrapper.

## Complexity Tracking

| Violation                                                   | Why Needed                                                                                                                                                                   | Simpler Alternative Rejected Because                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Rendition endpoint from configuration instead of a HAL link | Confirmed by the platform side (spec Clarifications): deployment configuration. `RuntimeAppConfig.renditionUri` already exists; Liaison `config.js` gains `v1.renditionUri`. | A link on the content resource would be cleaner but does not exist; the spec records this as the agreed model. |

## Implementation Sequence (input for `/speckit-tasks`)

1. **ADR-011 amendment first**: record the headless `@embedpdf/core` + plugin path (the ADR text names the drop-in `react-pdf-viewer`), PDFium/WASM instead of pdf.js with the scripting-posture requirement re-framed per engine, current versions and the 14-day rule, self-hosted WASM and CSP needs. No viewer code lands before this is merged.
2. **Foundations in `navigator-data`**: mimetype util + tests; `RENDITION_INVALID_CONVERSION`; config
   fields and Liaison schema; `requestRendition`
   state machine + tests (202→200, 202→invalid-conversion, 202 forever → timeout, abort); query key;
   `useContentPreview` + tests (stored PDF, rendition, no file/404, unsupported, error, cancel on
   attribute change); context + `useAppAuth` + `makeWrapper` extension.
3. **Viewer pattern in `@contentgrid/ui`**: add `@embedpdf/*` deps (pinned); engine provider with
   self-hosted wasm and disabled font fallback; `PdfViewer` with document-manager/viewport/scroll/render/
   zoom/search/print/selection plugins; toolbar (page nav + indicator + jump, zoom presets + fit modes,
   search popover with count/prev/next/Enter/Shift+Enter/match-case/whole-word, print, download
   callback, fullscreen); error boundary; protected-document and load-error callbacks; stories for each
   state + `play()` per control; a11y pass; `js-in-pdf.pdf` story asserting no dialog/side effect.
4. **Feature `entity-item-content-focus`**: layout, attribute selector, preview panel (lazy viewer,
   `useContentPreview`, `useDownloadContent` for Download, object-URL lifecycle), preview frame states
   - stories (SC-006), view with FR-001 branch reusing `EntityItemAttributes` and relation sections,
     `wasmUrl` util; feature `package.json` (`experimental`) and subpath export; unit tests.
5. **App wiring**: `apps/navigator-experimental` route mounts the view with primitive props; Vite
   asset/optimizeDeps checks; CSP notes for deployment (`worker-src blob:`, `connect-src` rendition
   origin); `.env.development` + MSW dev handlers for a rendition endpoint; e2e scenario with `Bob.pdf`
   (1 page, 330 kB) plus a new 20-page fixture for SC-001.
6. **Docs**: `packages/navigator-data/CLAUDE.md` note on the rendition protocol module; feature
   `CLAUDE.md` pointer; promotion checklist.
7. **Validation** per [quickstart.md](quickstart.md); independent review; open follow-ups: confirm
   rendition response contract + CORS with the platform team (ACC-2960), Liaison `renditionUri`
   delivery, ACC-2902 ownership.
