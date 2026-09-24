# Quickstart: validating the PDF viewer feature

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

## Prerequisites

- Node 20+, `corepack enable` → pnpm 11.5.2 (pinned in `package.json`); `pnpm install --frozen-lockfile`.
- A ContentGrid application with at least one entity that has a content attribute, a stored PDF item and
  a stored `.docx` item; or the MSW dev stub with the fixtures added by this feature.
- `.env.development.local` (ignored) in `apps/navigator-experimental` with `VITE_RENDITION_URI=<template with {?url}>`
  when testing against a real rendition service; leave it unset to validate the "not configured" path.

## Static checks

```bash
pnpm -r typecheck          # recursive: catches type errors in shared-package tests too
pnpm lint
pnpm format:check
pnpm test                  # vitest, all projects
```

Expected: green. New tests to look for: `packages/navigator-data/src/hooks/preview/use-content-preview.test.tsx`,
`packages/navigator-data/src/preview/*.test.ts`,
`packages/features/src/entity-item-content-focus/**/*.test.tsx`, `packages/ui/src/patterns/pdf-viewer/pdf-viewer.test.tsx`.

## Stories, visual and accessibility

```bash
pnpm storybook             # browse: UI/Patterns/PdfViewer, Features/EntityItemContentFocus/ContentPreviewFrame
pnpm test:storybook        # play() interactions: every toolbar control, JsInPdf asserts no dialog
pnpm test:visual           # Playwright snapshots (large + small viewport) for every state (SC-006)
pnpm test:a11y             # zero violations for viewer and frame stories (SC-003)
```

Baselines are generated in the pinned Linux Playwright image (see repo docs) before committing.

## Browser validation (experimental app)

```bash
pnpm --filter navigator-experimental dev
```

1. Open an item with a stored PDF → content-focus layout, page 1 rendered, indicator "1 / N", attribute
   panel on the right (US1-1). Next/previous, jump to page, scroll sync (US1-2, FR-008).
2. Zoom in/out, fit width, fit page; enter and leave fullscreen → same zoom mode (US1-3, US1-8).
3. Item with two content attributes → selector defaults to the first with a file; switching cancels the
   previous load, no flash of the previous document (US1-4). Watch the network tab: one request per
   selection, aborted on switch.
4. Item with an empty content attribute → "No file" with the drop zone (US1-5).
5. Entity without content attribute → attribute-focus layout, no viewer (US1-6).
6. Download → original filename, request carries the user's token (network tab), works from every state
   that has a file (US1-7, FR-012).
7. Non-PDF item with `VITE_RENDITION_URI` set → "Preparing preview", then the PDF; the initial and poll
   requests go to the rendition origin with the user's Bearer token and no other authentication call is
   made by the frontend; Download still delivers the
   original; a "converted preview" indicator is shown (US2-1, US2-2).
8. Non-PDF item without `VITE_RENDITION_URI` → "Preview not available" + Download, no request (US2-5).
9. Search a term: "n of m", Enter / Shift+Enter, match case, whole word, clear (US3-1, US3-2). Print opens
   the browser dialog with all pages (US3-3).
10. Keyboard only: Tab through every toolbar control, operate each, observe announcements with a screen
    reader or the a11y tree (US3-4).
11. Network tab, whole session: no request to `cdn.jsdelivr.net` or any host other than the app, the
    API and the rendition origin (FR-027). The `pdfium.wasm` request hits the app's own hashed asset.
12. Console: no CSP violations with the documented policy (`worker-src blob:`, `connect-src` incl. the
    rendition origin); the engine worker starts.

## Rendition failure paths (MSW dev handlers)

With the dev stub, switch the rendition handler mode and reload:

- `invalid-conversion` → "Preview not available" + Download within one poll interval (SC-004).
- `never` → "Preview could not be prepared" + Retry + Download after `timeoutMs` (+ one interval);
  polling stops; Retry restarts once.
- `error` (500) → same visible outcome with the problem title.
- Navigate away while pending → no further poll requests (FR-021).

## Scripting posture (FR-026, SC-005)

Story `PdfViewer/JsInPdf` loads `test-fixtures/pdf/js-in-pdf.pdf` (an `OpenAction` that would call
`app.alert`). The `play()` function fails if any dialog or `window.alert` occurs. Also open the same
fixture in the running app; nothing may execute.

## Performance sanity (SC-001, SC-002)

Chrome DevTools, "Fast 4G"/20 Mbit/s throttling, cold cache: open a 20-page ≤ 5 MB PDF item; first page
painted ≤ 3 s (record wasm and document transfer separately). Warm cache: ≤ 1 s. Page/zoom changes feel
instant (≤ 200 ms) on a 200-page fixture.

## End-to-end

```bash
pnpm --filter navigator test:e2e -- --grep "content focus"
```

The scenario logs in, opens a fixture item with `fixtures/Bob.pdf`, asserts the viewer, page indicator,
download filename and the attribute panel; runs in all four Playwright projects.

## Definition of done for the plan

All checks above green; independent review recorded with `scripts/navigator-review.sh`; SonarCloud
new-code coverage ≥ 80 %; ADR-011 amended; open items with the platform team tracked (ACC-2960, Liaison
`renditionUri`, CORS on the rendition service).
