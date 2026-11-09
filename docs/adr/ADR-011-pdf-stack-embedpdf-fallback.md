# ADR-011 — PDF stack: `@embedpdf/react-pdf-viewer` with vanilla pdfjs v5 fallback

**Date:** 2026-04-29
**Status:** Accepted (provisional — re-confirmed after spike 6B.2) — amended 2026-09-17
**Phase:** 0 — Alignment & decisions; revisited in Phase 6

> **2026-09-17 amendment note:** the entry point changed from the drop-in
> `@embedpdf/react-pdf-viewer` named in the original title/decision below to a headless
> `@embedpdf/core` + individual-plugin build — still the `@embedpdf` family this ADR
> committed to, not a new stack. See [Amendment 2026-09-17](#amendment-2026-09-17--spec-002-pdf-viewer-content-attribute-pdf-preview)
> for the full reasoning; the original decision and its annotation/citation-overlay
> reasoning are preserved below unchanged for that still-pending follow-up story.

---

## Context

The original navigator uses `pdfjs-dist@3.3.122` (pinned exact) with `@react-pdf-viewer/highlight` for the AI-extraction annotation overlay. The prototype adopted `@embedpdf/react-pdf-viewer`. The annotation/citation flow in Phase 6B is the highest-risk port in the entire roadmap; the PDF rendering surface is the single biggest contributor to that risk.

Two specific concerns:

1. **Coordinate-system parity.** Extraction annotations are positioned via fractional bounding boxes returned from the extract service. Different PDF viewers expose different coordinate APIs; mismatched coords mean misplaced highlights and a degraded extraction UX.
2. **CVE-2024-4367.** pdf.js had a code-execution vulnerability via `eval` of crafted JavaScript in PDF documents. v5 disables JS eval by default. We must verify that posture is preserved through whatever wrapper we ship.

Phase 6B.1 (extraction behaviour spec) and Phase 6B.2 (PDF coord-system reconciliation) are mandatory spikes during Phase 3 — their findings gate Phase 6 commitment.

## Decision

**Default: keep `@embedpdf/react-pdf-viewer` as adopted by the prototype.**

**Fallback (provisional, decided at end of spike 6B.2): swap to vanilla `pdfjs-dist` v5 + a thin custom highlight overlay.**

The fallback is not a contingency to be invoked silently mid-port — it is a decision point at the end of spike 6B.2, with a 1.5d budget added to Phase 6A if taken.

### Conditions that trigger the fallback

Any one of the following, surfaced during spike 6B.2:

1. `@embedpdf` annotation API does not expose a coord-system that maps cleanly to extract-service fractional bounding boxes (e.g. it normalises differently per page rotation, or strips precision below what extraction needs).
2. `@embedpdf` does not expose deterministic click-targets for annotations (we cannot reliably map a click on a highlight back to its citation).
3. `@embedpdf` re-enables JS eval, or its bundling pulls in pdf.js worker code that can't be configured to disable it. CVE-2024-4367 posture must be preserved.
4. `@embedpdf` plugin model adds friction we can't pay (e.g. the highlight plugin is incompatible with the search/print/zoom plugins we also need from 6A.1).

### What "fallback" means in concrete terms

If invoked:

- Replace `@embedpdf` packages in `apps/navigator` and `packages/features/pdf-preview/` with a direct `pdfjs-dist@^5` dependency.
- Build a small custom highlight overlay component in `packages/ui/src/patterns/PdfHighlightOverlay.tsx` — absolute-positioned divs over the canvas, using fractional coords from extract-service mapped via canvas viewport.
- Re-implement the toolbar (search, print, fullscreen, download, zoom) directly against pdfjs APIs. Larger surface than `@embedpdf/plugin-search` but no plugin-compatibility risk.
- Verify CVE-2024-4367 posture: `disableEval: true` in the pdfjs config; test with a malformed-JS fixture PDF.
- **Estimated extra cost:** +1.5d on Phase 6A. Tracked in the Phase 6 buffer.

## Why `@embedpdf` is the default

- The prototype already adopted it. Reverting is itself a cost.
- Plugin model gives us search/print/zoom/highlight without writing a viewer from scratch.
- Active maintenance (relative to direct pdfjs work, which is more DIY).
- React-friendly API matches the rest of the stack.

## Why vanilla pdfjs is the fallback (not another viewer)

- pdfjs is the source-of-truth implementation for PDF in the browser. No second engine to keep up with.
- The original navigator's experience is direct pdfjs — we know the patterns work for our extract-service shape.
- v5 brings the CVE-2024-4367 mitigation by default; the security concern is solved by the version, not by the wrapper.
- "Build a small custom highlight overlay" is a known-shape problem (~1d) rather than an unknown-shape one.

## Alternatives considered

| Option                                              | Why not the fallback                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`react-pdf` (wojtekmaj)**                         | Mature, but the highlight/annotation story is essentially "build it yourself" — same as the vanilla pdfjs fallback. No advantage, more dependency. |
| **`@react-pdf-viewer` (the original)**              | The original lib is `@react-pdf-viewer/core` + plugins — the prototype already deliberately moved off it. Going back undoes a deliberate choice.   |
| **Build entirely on canvas APIs (no pdfjs at all)** | Reinventing PDF rendering. Unserious.                                                                                                              |
| **PDFKit / native PDF viewer iframe**               | Loses the annotation overlay entirely. Defeats the purpose of the extraction flow.                                                                 |

## What stays the same in either path

- Citation navigation UI (jump between occurrences) is rebuilt in shadcn — independent of the PDF lib (Phase 6A.4).
- Rendition-aware preview (PDF rendition for Word/Excel/PowerPoint) — uses whichever PDF stack is current (Phase 6A.2).
- CVE-2024-4367 posture — mandatory pass; tested with a malformed-JS fixture in CI.
- Extract-service contract — fractional bounding boxes from the backend; both paths consume them.

## Spike 6B.2 deliverables

The spike that gates this ADR's conditional fallback must produce:

1. A working prototype of an `@embedpdf` highlight overlay rendering an extract-service response on a fixture PDF — or a written rejection with reasons mapping to one or more of the trigger conditions above.
2. A coord-system mapping function from extract-service fractional bboxes to `@embedpdf` annotation positions, including edge cases (rotated pages, multi-column layouts).
3. A click-event test confirming highlight → citation mapping is deterministic.
4. CVE-2024-4367 posture verification: a malformed-JS fixture PDF does not execute its payload under `@embedpdf`.

If any of (1)–(4) fails or surfaces unbounded work, fallback is taken. Decision is made before Phase 6A starts, not during Phase 6B implementation.

## Consequences

**Positive:**

- Phase 6 has a written decision rule rather than a "we'll figure it out" stance.
- Fallback path is sized and scheduled. Not infinite work.
- CVE-2024-4367 posture is a mandatory test case in either path — security doesn't get skipped under time pressure.
- The estimate buffer covers the fallback if taken (Phase 6 doubling is already in the pessimistic case).

**Negative / accepted:**

- Two-path planning is more upfront thinking than committing to one stack and iterating.
- The +1.5d fallback budget eats into Phase 6's slack if taken. If both this fallback _and_ unrelated 6B issues hit, schedule pressure is real.

## Reconsider when

- pdfjs releases a v6 with materially different security or API posture.
- `@embedpdf` lands a release that addresses any of the trigger conditions cleanly.
- The extract service changes its bounding-box format (e.g. moves to absolute pixel coords). Then coord-system mapping is a different problem and this ADR is replaced.
- **`@embedpdf` maintenance velocity drops below pdf.js's** — e.g. a pdf.js security patch waits weeks for a corresponding `@embedpdf` release, or commits to the upstream repo go quiet for a quarter. Cost isn't the watch-out (MIT-licensed, no paid tier); maintenance horizon is. If `@embedpdf` stalls, the vanilla pdfjs v5 fallback becomes the default rather than the contingency.

---

## Amendment 2026-09-17 — spec 002-pdf-viewer (content-attribute PDF preview)

**Context:** spec `002-pdf-viewer` ships the first real consumer of this ADR's stack — a
read-only content-attribute PDF viewer (page navigation, zoom, search, print, download,
fullscreen), not yet the extraction/annotation overlay Phase 6B originally scoped this ADR
around. `/speckit-plan`'s Phase 0 research (`specs/002-pdf-viewer/research.md` §8.1–8.2)
re-examined the concrete `@embedpdf` entry point and found the drop-in
`@embedpdf/react-pdf-viewer` unusable for this feature's constraints. This amendment updates
the decision and the CVE-2024-4367 posture framing; it does not re-litigate anything about
the annotation overlay itself, which remains future work under the original decision text
above.

### Decision update: headless `@embedpdf/core` + individual plugins, not the drop-in viewer

Build the viewer from `@embedpdf/core` (the `EmbedPDF` provider, `usePdfiumEngine`) plus the
individual plugins the feature needs — `plugin-document-manager`, `plugin-viewport`,
`plugin-scroll`, `plugin-render`, `plugin-zoom`, `plugin-search`, `plugin-print`,
`plugin-selection`, `plugin-interaction-manager` — with our own shadcn toolbar
(`packages/ui/src/patterns/pdf-viewer/`), instead of the drop-in `@embedpdf/react-pdf-viewer`
this ADR's title and original decision named as the default. This is still the `@embedpdf`
family — the headless entry point of the same package family, not a new stack — so this ADR
is amended rather than superseded.

**Why the drop-in viewer doesn't work here:**

- It injects every stylesheet at runtime with no nonce support (upstream issue #818),
  breaking under a strict `style-src` CSP.
- It renders inside a shadow DOM: theming needs style injection into that boundary, and
  Radix's scroll-lock cancels wheel events inside it.
- It pulls in `@embedpdf/snippet` (~9.7 MB unpacked, 30+ plugins) when this feature needs
  eight or nine.
- The mockup's specific toolbar (attribute selector, page jump, zoom presets/fit modes,
  search popover, print, download, fullscreen) is only reachable with our own controls, not
  the drop-in's fixed toolbar.

### CVE-2024-4367 posture reframed: PDFium/WASM, not pdf.js

The original context above frames the security concern in terms of pdf.js's `eval`-based
code execution and v5's default mitigation for it. **EmbedPDF renders with PDFium compiled
to WebAssembly (`@embedpdf/pdfium`), not pdf.js at all** — pdf.js's specific v5 `disableEval`
mitigation does not apply to this engine, so the posture must be stated in the engine's own
terms: **document scripting is disabled in the PDFium engine, proven by a fixture test.**
`test-fixtures/pdf/js-in-pdf.pdf` (a valid one-page PDF whose Catalog carries an
`/OpenAction << /S /JavaScript /JS (app.alert('x')) >>`) is committed for exactly this
purpose; the pdf-viewer pattern's `JsInPdf` Storybook story (`pdf-viewer.stories.tsx`) opens
it and its `play()` function asserts no `dialog`/`alert` side effect occurs (FR-026/SC-005 in
`specs/002-pdf-viewer/spec.md`). This is the same class of guarantee the original ADR wanted
(a fixture-tested scripting posture), carried over to the actual engine in use.

### Versions, as of this amendment (2026-09-17)

- `@embedpdf/core`, `@embedpdf/engines`, `@embedpdf/pdfium`, `@embedpdf/models`, and every
  `@embedpdf/plugin-*` package above: pinned to the same exact version across the family,
  **2.15.0** (published 2026-08-04; 2.15.1 exists but is too recent for the 14-day
  `minimumReleaseAge` window on the install date this amendment records). No lifecycle/install
  scripts on any of them.
- `pdfjs-dist` is now at major version 6.x. This feature does not depend on it — it is noted
  here only because the original ADR text above still discusses a "vanilla pdfjs v5 fallback";
  that fallback path (and its version target) is unchanged and untouched by this amendment,
  it just hasn't been exercised.
- `@react-pdf-viewer` — named in the original ADR's Alternatives table as "the original" the
  prototype moved off of — has had no release since 2023-03. It is not a live alternative for
  any future reconsideration of this decision; noted here so a future reader doesn't spend time
  re-evaluating a dead package.

### Self-hosted WASM, `blob:` worker, no CDN

- `pdfium.wasm` (~4.4 MB) is imported in the feature as `@embedpdf/pdfium/dist/pdfium.wasm?url`
  (Vite emits it as a hashed, immutable-cacheable asset) and turned into an absolute URL via
  `new URL(url, window.location.href).href` before being passed as `usePdfiumEngine`'s
  `wasmUrl`. A relative URL breaks once resolved from inside the engine's `blob:` module
  worker (upstream issue #633) — this is not optional.
- `@embedpdf/engines` defaults to fetching `pdfium.wasm` from `cdn.jsdelivr.net`; self-hosting
  it is required both by this project's no-third-party-CDN rule and by FR-027 in
  `specs/002-pdf-viewer/spec.md` (document bytes and every viewer asset stay first-party).
- The engine's worker is created as a `blob:` module worker with no external-URL option yet —
  deployments must allow `worker-src blob:` in CSP.
- Font fallback is disabled (`fontFallback: { fonts: {} }`, not `null` — see upstream issue
  #631) so no glyph fonts are fetched from jsDelivr either, keeping the "no third-party CDN
  asset" guarantee complete.

### What this amendment does not decide

The annotation/citation-overlay work this ADR was originally written for (Phase 6B,
coordinate-system parity, click-target mapping, the conditional pdfjs fallback and its
trigger conditions) is **out of scope for spec 002-pdf-viewer** and unaffected by this
amendment — it remains exactly as decided in the sections above, for whenever that follow-up
story starts. If that story later hits one of the fallback trigger conditions against the
headless `@embedpdf/core` build instead of the drop-in viewer, evaluate it against the same
four conditions; nothing here changes that evaluation.

### Consequences (2026-09-17 amendment)

**Positive:**

- The headless build sidesteps every drop-in-viewer blocker found in research (nonce-less style
  injection, shadow-DOM theming/scroll-lock conflicts, the ~9.7 MB/30-plugin footprint) without
  leaving the `@embedpdf` family this ADR committed to.
- The scripting-posture guarantee (CVE-2024-4367's original concern, reframed for PDFium/WASM)
  is a committed, automated check — the `JsInPdf` Storybook `play()` assertion — not a one-time
  manual verification, so a regression here fails visibly rather than silently.
- Self-hosting `pdfium.wasm` (no CDN) and building our own shadcn toolbar keep this feature
  inside the project's existing no-third-party-asset and design-system conventions, rather than
  inheriting the drop-in viewer's own asset/style choices.

**Negative / accepted:**

- More upfront integration work than the drop-in viewer would have needed: this feature owns
  its own toolbar (page navigation, zoom, search, print, download, fullscreen) instead of
  getting one for free, and wires eight or nine individual plugins rather than one package.
- New deployment surface the original decision didn't carry: a `blob:` module worker (CSP
  `worker-src blob:`), and — once rendition-aware preview is in the picture — a second CSP
  `connect-src` origin plus CORS/`Authorization`/`Location`-exposure requirements on the
  rendition service (see this feature's `CLAUDE.md` "Deployment requirements" section). These
  are now real conditions an operator must satisfy before this feature works in production, not
  just a library choice.
- The rendition service's response contract itself is still reverse-engineered, not
  platform-documented — tracked as an open confirmation in ACC-2960, unchanged by this
  amendment (it was already an open item; the headless-build decision doesn't resolve it).

---

**Hub:** [[README|ADR Index]]
