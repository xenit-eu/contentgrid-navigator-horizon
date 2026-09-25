# packages/ui — CLAUDE.md

Package: `@contentgrid/ui`
Purpose: Shared UI component library. Contains shadcn primitives (owned copies) and
Amexio/Navigator patterns composed from them. Consumed by all three tracks
(generic, experimental, custom) via `pnpm workspace:*`.

Platform-wide conventions (HAL, ABAC, auth, error types): see root [`CLAUDE.md`](../../CLAUDE.md).

---

## Directory layout

```
packages/ui/src/
  primitives/    # shadcn/ui components, copied-in and owned by us
  patterns/      # composed Navigator-domain components built on primitives
  index.ts       # barrel — every public export goes here
```

---

## Primitive vs. pattern boundary

Source: [ADR-003](../../docs/adr/ADR-003-ui-stack-tailwind-shadcn.md).

- **Primitive** — a low-level, generally reusable UI building block derived from
  shadcn/ui (backed by Radix UI). Lives in `src/primitives/`. Examples:
  `button`, `dialog`, `input`, `select`, `table`.
  - No Navigator-domain knowledge. No HAL types. No entity concepts.
  - Radix UI is consumed ONLY inside `packages/ui` — apps and other packages
    must not import Radix directly.
- **Pattern** — a composed component that encodes Navigator-domain semantics.
  Lives in `src/patterns/`. Examples: `EntityCard`, `DataTable`,
  `AutocompleteRenderer`, HAL-Forms field renderers, `PdfHighlightOverlay`.
  - The HAL-Forms field renderers (`src/patterns/form-renderers/`) take plain scalar props
    (`name`, `label`, `required`, `readOnly`, `description?`, `value`, `onChange`, `error?`,
    plus type-specific constraints like `includesTime`/`options`) — NOT a descriptor object.
    The `kind`-dispatching switch and the `FieldDescriptor` type itself live in
    `packages/features/src/entity-item-create/` (ADR-004), not here; these components have no
    dependency on that type or on any HAL-Forms shape, and do NOT import `@contentgrid/hal` or
    `@contentgrid/hal-forms` directly.
  - If a pattern is only used in one feature, it belongs in
    `packages/features/<feature>/`, NOT here. The registry is for patterns
    reused across multiple tracks or apps.

---

## shadcn-CLI usage

Rule: run `pnpm shadcn add <component>` directly. Do NOT use a wrapper script.
([ADR-012](../../docs/adr/ADR-012-no-shadcn-cli-wrapper.md))

Why: wrapper CLIs go stale on shadcn upstream bumps; conventions belong in lint
and code review, not in a vendor-intercepting tool.

**To add an upstream shadcn primitive:**

```
pnpm --filter @contentgrid/ui shadcn add button
```

Then follow the post-add checklist (see below).

**To add a ContentGrid pattern from the CG registry:**

```
pnpm shadcn add @contentgrid/entity-card
```

Same command, different registry source. No extra scaffolding needed for
registry entries.

**To write a new pattern locally** (not from registry):

```
# write packages/ui/src/patterns/<kebab-case-name>.tsx
# write packages/ui/src/patterns/<kebab-case-name>.stories.tsx
# add export to packages/ui/src/index.ts
```

No CLI involved.

**Post-add checklist for primitives:**

- File name: `kebab-case.tsx` in `src/primitives/`.
- Export name: `PascalCase`, re-exported from `src/index.ts`.
- Story: `<name>.stories.tsx` alongside the component (ADR-009).
- Lint catches missing barrel exports and missing stories in CI.

---

## Naming conventions

- Files: `kebab-case.tsx` / `kebab-case.stories.tsx`.
- Exported components: `PascalCase`.
- Hooks inside `packages/ui`: `usePascalCase` — but prefer keeping hooks in
  `packages/navigator-data` if they touch HAL or server state.

---

## Forbidden imports

- Do NOT import from `apps/*`. This is a shared package.
- Do NOT import `@contentgrid/hal`, `@contentgrid/hal-forms`,
  `@contentgrid/typed-fetch`, `@contentgrid/fetch-hooks`,
  `@contentgrid/fetch-hook-authentication`, `@contentgrid/problem-details`,
  or `@contentgrid/uri-template` — those belong in `packages/navigator-data`.
  The form-renderer patterns take plain scalar props (see above), not a `FieldDescriptor` or any
  other HAL-Forms-shaped type — that type lives in `packages/features/src/entity-item-create/`.
- Do NOT import from `packages/features/*` — features depend on `packages/ui`,
  not the other way around.
- Do NOT import Radix UI (`@radix-ui/*`) outside `packages/ui`. Inside
  `packages/ui`, Radix is fine — it underpins the primitives.

---

## HAL-FORMS metadata in pattern components

Per ADR-004, `packages/ui`'s form-renderer patterns
(`src/patterns/form-renderers/`) are **descriptor-agnostic**: they never see a `FieldDescriptor`,
a `HalFormsProperty`, or any other HAL-Forms-shaped value. The `kind` switch that reads a
`FieldDescriptor` and unpacks it into plain props lives in
`packages/features/src/entity-item-create/render/field-renderer.tsx`, one layer up.

- Each renderer takes plain scalar props only: `name`, `label`, `required`, `readOnly`,
  `description?`, `value`, `onChange`, `error?`, plus type-specific constraints
  (`includesTime` for datetime, `options`/`isRemote` for enum, `min`/`max`/`step` for number,
  etc.). Do NOT reintroduce a descriptor-object prop (`field: SomeDescriptorType`) — that couples
  this package to a specific descriptor shape, which is exactly what this boundary keeps out. A
  caller unpacks its own descriptor type into these props before rendering.
- `enum`/`enum-multi` renderers take already-resolved `options: readonly EnumOption[]`
  (`{ value: string; label: string }` — `value` is the machine token submitted to the server,
  `label` is the HAL-FORMS option's `prompt`, kept separate because attribute/enum values are
  customer-defined tokens, not display text) plus an `isRemote?: boolean` flag for "not yet
  loaded" — they never see a raw HAL-FORMS options object or resolve a remote `options.link`
  themselves.
- Remote option FETCHING stays out of `packages/ui`, unchanged: the caller (in
  `packages/features`) decides `isRemote` and supplies already-resolved `options` once loaded.
- Why: `packages/ui` is the rendering layer; data fetching and HAL-Forms-shaped state belong in
  `packages/navigator-data`/`packages/features`. Mixing them violates the two-layer model
  (ADR-007) and would pull Layer-1 packages into the UI bundle.

---

## `PdfViewer` pattern (`src/patterns/pdf-viewer/`)

Headless `@embedpdf/core` + plugin composition with a shadcn toolbar (page
navigation, zoom, search, print, download, fullscreen; text selection
enabled). See `specs/002-pdf-viewer/contracts/pdf-viewer-pattern.md` for the
full props contract. Files: `pdf-viewer.tsx` (composition + `PdfViewerErrorBoundary`),
`pdf-engine-provider.tsx` (shared PDFium/WASM engine + Strict-Mode
double-invoke guard, upstream #700), `use-pdf-viewer-document-lifecycle.ts`
(`useDocumentLifecycle`), `use-pdf-viewer-state.ts` (`usePdfViewerActiveState`
— page/zoom/fullscreen/print), `use-pdf-viewer-search.ts`
(`useDocumentSearchState` — search state/actions, split out because it has a
clean input/output boundary of its own; `use-pdf-viewer-state.ts` re-exports
its public types so existing imports don't need updating), `pdf-viewer-toolbar.tsx`,
`pdf-viewer-icon-button.tsx` (shared `IconButton`, used by both the toolbar
and the search popover), `pdf-viewer-search-popover.tsx`
(`PdfViewerSearchPopover`), `pdf-viewer-labels.ts`, `pdf-viewer-story-helpers.tsx`
(shared story harness — not a `*.stories.tsx` file itself, so Storybook's
story glob skips it), `fixtures/` (hand-built `minimal.pdf` / `js-in-pdf.pdf`).
Stories live in two files sharing one `title`
(`Patterns/PdfViewer`, same sidebar group): `pdf-viewer.stories.tsx` (visual/
a11y snapshots) and `pdf-viewer.interaction.stories.tsx` (`WithInteraction`
only — see below).

- **`wasmUrl` must be an absolute, self-hosted URL — never a CDN URL.**
  `usePdfiumEngine` defaults to fetching `pdfium.wasm` from jsDelivr when no
  `wasmUrl` is given; this pattern always passes one explicitly and disables
  the font-fallback CDN too (`fontFallback: { fonts: {} }`, not `null` —
  `null` still hits the CDN per upstream #631).
  - **`@embedpdf/pdfium`'s own `exports` map only exposes the wasm binary at
    the `./pdfium.wasm` subpath**, i.e. `import wasmUrl from
"@embedpdf/pdfium/pdfium.wasm?url"` — **not** `.../dist/pdfium.wasm?url`,
    even though that is the file's real on-disk location inside the package.
    The `dist/...` path fails to resolve under Vite/Rolldown's
    `exports`-conditions resolution (`"./dist/pdfium.wasm" is not exported
under the conditions [...]`). Found by actually building Storybook, not
    from the package's types.
- **CSP**: the engine's worker is a `blob:` module worker → deployments need
  `worker-src blob:`. No other third-party origin is contacted (FR-027).
- **`useScroll`/`useZoom` (and any other per-document plugin hook) must never
  be called with a placeholder/empty document id.** Unlike
  `useDocumentState`, which is documented to accept `null`, these throw
  synchronously (`"Zoom state not found for document: ..."`) for a document
  id that was never registered — found by running the stories under real
  Chromium (jsdom/Vitest can't catch this; the real engine can). This is why
  `useDocumentLifecycle` (`use-pdf-viewer-document-lifecycle.ts`, safe to call
  unconditionally: document-manager + `useDocumentState` only) is a separate
  hook from `usePdfViewerActiveState` (`use-pdf-viewer-state.ts` — scroll +
  zoom + print + search; `pdf-viewer.tsx`'s `PdfViewerActiveSession`
  component mounts it only once a real document id exists) rather than one
  hook that substitutes `documentId ?? ""`.
- **Engine-init failures are unreliable to trigger and largely unobservable
  from the outside** (upstream #632): a bad `wasmUrl` genuinely fails to
  compile inside the engine's worker (a real `WebAssembly.instantiate():
BufferSource argument is empty` reaches the console), but
  `usePdfiumEngine` doesn't propagate that into its `{ error }` result — the
  hook still resolves to a working engine. `PdfEngineProvider` here still
  exposes `{ status: "error" }` for the cases the hook does surface, but the
  `EngineFailure` story mocks the resulting UI rather than the trigger,
  because no known prop combination reproduces the real failure
  deterministically.
- **One engine per subtree**: `PdfViewer` creates its own `PdfEngineProvider`
  only when it isn't already wrapped by one (`useAmbientPdfEngineStatus()`
  returns `undefined`) — wrap several `PdfViewer`s in one `PdfEngineProvider`
  to share a single engine/worker instead of creating one per viewer.
- **Search and print (US3) are wired**: `SearchPluginPackage` and
  `PrintPluginPackage` are registered from their `/react` subpaths — the
  print package from `/react` auto-mounts its `PrintFrame` utility (the
  hidden iframe that does the real `contentWindow.print()`; it's a single
  export built via `createPluginPackage(...).addUtility(PrintFrame).build()`,
  not a separately-named `WithAutoMount` export); the search one has no
  auto-mount utility, so `SearchLayer` is mounted explicitly per page, styled
  distinctly from `SelectionLayer` via its own default highlight colors).
  `use-pdf-viewer-search.ts`'s `useDocumentSearchState` returns
  `search`/`searchActions` (`PdfViewerSearchState`/`PdfViewerSearchActions`),
  composed into `usePdfViewerActiveState`'s result as an additive slice
  alongside `actions.print` — no reshaping of the existing
  `page`/`zoom`/`fullscreen`/`actions` fields, matching the seam this file
  used to document as reserved.
  - `matchCase`/`wholeWord` map to `MatchFlag.MatchCase` (`1`) /
    `MatchFlag.MatchWholeWord` (`2`) from `@embedpdf/models` — confirmed from
    `node_modules/@embedpdf/models/dist/pdf.d.ts`, not documented anywhere
    else. Toggling calls the plugin's `setFlags` with the flags array with
    that member added/removed; the plugin re-searches automatically if a
    search is already active.
  - `useSearch`/`usePrint` (unlike `useScroll`/`useZoom`) never throw for an
    unregistered document id — both gracefully fall back to an empty/`null`
    result (verified against the compiled `@embedpdf/plugin-search` /
    `@embedpdf/plugin-print` `/react` sources) — so they need no extra
    gating beyond the existing "only mounted once `documentId` is real" rule.
  - **The active match is scrolled into view (FR-014) by our own code, not
    by the plugin.** Neither `@embedpdf/plugin-search` nor any other
    installed `@embedpdf/*` package does this: `nextResult`/`previousResult`/
    a fresh search only dispatch `setActiveResultIndex` and notify
    `onActiveResultChange` — confirmed by reading the compiled
    `plugin-search` source and grepping every installed `@embedpdf/*` package
    for a consumer of that event (there is none). `useDocumentSearchState`
    derives the active result's page from
    `searchState.results[activeResultIndex]` and calls
    `scroll.scrollToPage({ pageNumber: pageIndex + 1, pageCoordinates: rect.origin, behavior: "smooth", alignX: 50, alignY: 50 })`
    itself, deduplicated by the active result's own identity
    (`pageIndex:charIndex`, not "already on the current page" — a page can
    hold more than one match, and being on the right page doesn't guarantee
    the specific rect is still in the viewport). `SearchResult.rects[0].origin`
    is in the same page-local, unscaled coordinate space
    `ScrollToPageOptions.pageCoordinates` expects (confirmed from
    `@embedpdf/plugin-scroll`'s compiled `getScrollPositionForPage`) — the
    same values `SearchLayer` itself draws its highlight rects from,
    pre-scale. `scroll` (`useScroll(documentId).provides`) is threaded into
    `useDocumentSearchState` by `usePdfViewerActiveState` rather than
    obtained via a second `useScroll` call there.
  - "Clear" and closing the search popover both call the plugin's
    `stopSearch()`, which resets `query`/`results`/`total`/`activeResultIndex`
    to their initial values in one dispatch (confirmed from the compiled
    `plugin-search` reducer) — there is no separate "clear" action to keep in
    sync.
  - The search `Popover`'s content (`pdf-viewer-search-popover.tsx`) renders
    through a Radix `Portal` into `document.body`, not into the story's
    `canvasElement` — same as the zoom preset `DropdownMenu` above it. A
    story's `play()` must query it via `within(document.body)`, matching
    `dropdown-menu.stories.tsx`'s existing interaction story.
  - **Storybook harness quirk, not a component bug**: in a `play()` function,
    a Radix `Popover` that is opened and then must stay open across a
    `step(name, fn)` **boundary** (i.e. the popover needs to survive into the
    _next_ `step()` call) can get dismissed by the harness itself — verified
    empirically under real Chromium that the popover stays open and fully
    interactive for as long as everything (open, type, navigate, toggle,
    clear) happens inside **one** `step()` call, and only closes exactly at
    the transition to the next one. `WithInteraction` below keeps the whole
    search sequence in a single step, before any other step boundary, rather
    than fighting this.
- **`WithInteraction` story convention**: `apps/storybook/tests/interaction.spec.ts`
  only runs `play()` for a story whose CSF export is named exactly
  `WithInteraction` (display name "With Interaction"); every other story here
  is a pure visual/a11y snapshot with no `play()` at all. `WithInteraction`
  lives in its own file, `pdf-viewer.interaction.stories.tsx` (`pdf-viewer.stories.tsx`
  was growing past ~500 lines and this one story alone was ~130 of them) —
  it shares the same `title: "Patterns/PdfViewer"` as the visual file, so
  both land under the same Storybook sidebar group, and only the visual
  file's `meta` carries the `autodocs` tag (a second copy on the interaction
  file's `meta` would generate a duplicate "Docs" page for the same title).
  `WithInteraction` is tagged `no-visual-test` (also excluded from
  `test:visual` and, importantly, from `test:a11y` — a `play()`-bearing story
  races the addon-a11y auto-scan against `AxeBuilder.analyze()`, see
  `apps/storybook/tests/accessibility.spec.ts`). A story that must keep its
  own `play()` for some other reason should carry that same tag. Four of the
  visual file's own stories — `Default`/`ToolbarMinimal`/`Invalid`/`JsInPdf`,
  each individually tagged, not the shared `meta` — mount a real PDFium/WASM
  engine, so the content area reports `aria-busy="true"` until the first page
  paints (or, for `Invalid`, until the terminal invalid-document message
  replaces it); `apps/storybook/tests/visual.spec.ts` waits for that to clear
  before screenshotting — opt-in per story (not a generic wait) so a
  permanently-busy loading-state story never times the harness out. The five
  mocked stories (`Protected`/`EngineFailure`/`SearchOpen`/`SearchNoResults`/
  `PrintReady`) never render `aria-busy="true"`, so they don't carry the tag.
  `PdfViewerHarness`'s own
  "Loading fixture…" placeholder (`pdf-viewer-story-helpers.tsx`, shown while
  it fetches the story's PDF bytes) is busy too, so the story is busy from
  its very first commit rather than leaving a gap the harness could race.
  `WithInteraction` consolidates every behavioural check for this pattern,
  including the FR-026/SC-005 no-script-execution proof (`js-in-pdf.pdf`,
  stubbing `window.alert`/`confirm`/`prompt`) and the full search/print flow.
  Both story files share their harness (`PdfViewerHarness`/`StoryFrame`/
  `wasmUrl`) via `pdf-viewer-story-helpers.tsx`, named without `.stories.` so
  Storybook's `**/*.stories.@(ts|tsx)` glob (`apps/storybook/.storybook/main.ts`)
  doesn't pick it up as a story module in its own right.
- New stories needing Playwright visual baselines (pinned Linux image, not
  generated in this change): `Patterns/PdfViewer` — `Default`,
  `ToolbarMinimal`, `Protected`, `Invalid`, `EngineFailure`, `JsInPdf`,
  `SearchOpen`, `SearchNoResults`, `PrintReady`.

---

## peerDep policy

`react` and `react-dom` are `peerDependencies`. Do not move them to
`dependencies`. For the full rationale see
[ADR-007](../../docs/adr/ADR-007-two-layer-dependency-model.md) and
[`packages/navigator-data/CLAUDE.md`](../navigator-data/CLAUDE.md).
