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

**Results (2026-09-17)** — Apple M5, Chromium 149.0.7827.55 (Playwright 1.61.1 bundled),
`navigator-experimental` dev server against the MSW dev fixtures. Emulation: CDP
`Network.emulateNetworkConditions` at 20 Mbit/s down/up, 40 ms latency; cache disabled for cold runs,
enabled for warm. 3 samples (first paint) / 5 samples (page, zoom) per row; medians below.

| Measurement               | Fixture                    | Median | Target   | Result |
| ------------------------- | -------------------------- | ------ | -------- | ------ |
| First page painted (cold) | 20-page `twenty-pages.pdf` | 7.77 s | ≤ 3 s    | FAIL   |
| First page painted (warm) | 20-page                    | 3.94 s | ≤ 1 s    | FAIL   |
| Page jump                 | 20-page                    | 7 ms   | ≤ 200 ms | PASS   |
| Zoom in                   | 20-page                    | 45 ms  | ≤ 200 ms | PASS   |
| Page jump                 | 200-page (generated)       | 7 ms   | ≤ 200 ms | PASS   |
| Zoom in                   | 200-page (generated)       | 49 ms  | ≤ 200 ms | PASS   |

Transfer sizes: `pdfium*.wasm` 4.63 MB; `twenty-pages.pdf` 5.6 kB. **Verdict**: SC-002 (page/zoom
≤ 200 ms) met at both 20 and 200 pages. SC-001 (first page ≤ 3 s cold / ≤ 1 s warm) is **not met** at
either threshold — the ~4.6 MB `pdfium.wasm` fetch + instantiation dominates first paint, independent
of document size. "Next page" was disabled by an unrelated bug hit during this run (total-page count
stuck at 0 on first load), so page-navigation latency was measured via direct page-number entry
instead; the 200-page fixture was generated with
`packages/navigator-data/test-fixtures/pdf/generate-fixtures.py`'s `build_pdf()` and served only via a
test-harness network substitution — no fixture file was added to the repo. Full findings in
`browser-verification.md` (session scratchpad).

**Caveat**: these numbers were measured against the Vite dev server — unbundled ES modules, no
compression, no long-lived caching — so the first-paint rows above are not representative of a
production deployment. `pdfium.wasm` is 4.63 MB raw but 2.13 MB gzip / 1.64 MB brotli, and in
production it is served once with a content-hashed filename and cached by the browser thereafter.
SC-001 must be re-measured against a production build behind the real gateway before promotion;
SC-002 (page/zoom latency) is unaffected by bundling/compression and holds as measured.

## End-to-end

```bash
pnpm --filter navigator-experimental dev            # boots the experimental app on :5174
NAVIGATOR_EXPERIMENTAL_URL=http://localhost:5174 pnpm --filter navigator exec playwright \
  test content-focus.spec.ts
```

Targets `apps/navigator-experimental` directly — this feature is experimental-only, and `apps/navigator`
has no route that renders it. Runs against the app's MSW dev fixtures (`doc-1`/`doc-2`/`doc-3` in
`src/mocks/content-focus-handlers.ts` and `rendition-handlers.ts`), so there is no login step and no
`.env.test` credentials, unlike every other spec in this directory. The whole `describe` block is
skipped when `NAVIGATOR_EXPERIMENTAL_URL` is unset; otherwise it runs in all four of `apps/navigator`'s
Playwright projects (chromium/firefox × large/small viewport — per-project browser/viewport settings,
independent of `baseURL`). Asserts the single- and multi-page viewer, page indicator, zoom, content-
attribute switching, download filename, and both rendition outcomes (`ready`, `invalid-conversion`).
This spec currently cannot pass against the dev fixtures because of a pre-existing crash on `main`:
`ProfileEntity.getDefaultPreferences()` (`packages/navigator-data/src/accessors/entity-profile.ts`)
non-null-asserts `idAttribute`, and the shared demo "invoice" profile in
`packages/navigator-data/test-fixtures/hal/fixtures.ts` has no attributes, so `SidebarEntityNav`
throws on every route; the "document" fixture now carries an `id` attribute, and the invoice
fixture fix is tracked separately.

## Definition of done for the plan

All checks above green; independent review recorded with `scripts/navigator-review.sh`; SonarCloud
new-code coverage ≥ 80 %; ADR-011 amended; open items with the platform team tracked (ACC-2960, Liaison
`renditionUri`, CORS on the rendition service).
