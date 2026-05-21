# ADR-011 — PDF stack: `@embedpdf/react-pdf-viewer` with vanilla pdfjs v5 fallback

**Date:** 2026-04-29
**Status:** Accepted (provisional — re-confirmed after spike 6B.2)
**Phase:** 0 — Alignment & decisions; revisited in Phase 6

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

**Hub:** [[README|ADR Index]]
