# Research: PDF viewer, annotation overlay and rendition preview

**Feature**: [`spec.md`](spec.md) | **Date**: 2026-09-17 | **Purpose**: record how the existing
implementations behave and what the current stack offers, so the spec is grounded and `/speckit-plan`
does not have to rediscover it. This file is input to the plan; it contains no requirements.

**Scope note (2026-09-17)**: the annotation / extraction-highlight overlay was taken **out** of spec 002 by
Nick ("this just makes sure the pdf-viewer is there and the toolbar is present"). The findings on it
(§1.4, §5 highlights, §7 annotation plugin, §8 questions 1, 3, 4) are kept here as input for the
follow-up annotation story and are not requirements of spec 002.

Sources examined (all read-only):

| Source                      | Location                                                                     | State examined                                                                            |
| --------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Original Navigator          | `xenit-eu/contentgrid-navigator`, local clone `~/CODE/contentgrid-navigator` | `main` at `a8195446` (2026-09-16)                                                         |
| Imelda frontend             | `xenit-eu/imelda-vgsiz-cg-frontend`, local clone                             | `main` at `b54b762` (2026-09-15) — customer delivery, datapoint only, no code copied here |
| Prototype                   | `~/CODE/contentgrid-navigator-prototype`                                     | `c3c0e91` (2026-03-18)                                                                    |
| Horizon (this repo)         | `packages/navigator-data`, `packages/features`, `apps/navigator`             | `main` at `35ff6b1e`                                                                      |
| Design mockup               | `~/Downloads/contentgrid-navigator-mockup 2.html`, pages 03/04               | 2026-06-10                                                                                |
| npm registry, EmbedPDF docs | see §7                                                                       | 2026-09-17                                                                                |
| Jira (ACC project)          | epic ACC-2835 children + rendition tickets                                   | 2026-09-17                                                                                |

The full agent reports behind this summary (with every `path:line` reference) were produced in this
session; the code excerpts below are condensed from them (logic unchanged, formatting compacted;
`path:line` points at the real source).

---

## 1. Original Navigator (production behaviour to reproduce)

### 1.1 Stack

- `pdfjs-dist ^3.3.122` (resolved 3.11.174), `@react-pdf-viewer/core|default-layout|highlight ^3.11–3.12`,
  plus **undeclared** transitive imports of `@react-pdf-viewer/toolbar|zoom|get-file|print|full-screen|search`.
  `@react-pdf-viewer` has had **no release since 2023-03** (see §7) — not a viable base.
- One global pdf.js worker for the app lifetime: `<Worker workerUrl={pdfWorkerUrl}>` wraps the whole
  authenticated tree (`src/app/App.tsx:110-121`).

### 1.2 Structure and gating

```
src/modules/FileViewer/
  components/EntityInstanceFiles.tsx            content-attribute selector, close/open-in-window
  components/FileViewerContentRenderer.tsx      loading / error / empty / upload gate
  components/FilePreview.tsx                    mimetype → PdfViewer | ImagePreview | VideoPlayer | NoPreview
  components/PdfViewer.tsx                      @react-pdf-viewer wiring + toolbar
  components/PdfViewerExtractionAnnotationRenderer.tsx   renderHighlights callback (citation overlay)
  hooks/useObjectUrl.ts                         blob → revocable object URL
```

Gate (`FilePreview.tsx:22-46`): `mimetype === 'application/pdf'` → PDF viewer; `image/*` → `<img>`;
`video/*` → `<video>`; else `NoPreview` (message + Download). Metadata (`length`, `mimetype`, `filename`)
comes from the content attribute on the entity item; content links come **only** from the `cg:content`
relation (`EntityInstanceAccessor.ts:33-35`).

Bytes: TanStack Query keyed `['Instance', selfHref, contentLink.href]`; authenticated `GET` with
`Accept: */*`; `404` → "no content" sentinel; response → `Blob` → revocable object URL fed to the viewer
(`useEntityInstanceState.ts:150-195`). No client-side size limit. Full download before render
(byte-range streaming confirmed out of scope in the roadmap).

Mounted in two places: the detail page (`EntityInstanceContentFocus.tsx:59-67`, **without** an
extraction context → highlights never appear there) and the create page
(`CreateEntityInstance.tsx:182-196`, inside `ExtractionContextProvider`).

### 1.3 Toolbar

| Feature                       | Present      | Notes                                                                                                                                                                                                                                        |
| ----------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zoom in/out + percentage      | yes          | rounded `Math.round(scale*100)`                                                                                                                                                                                                              |
| Fullscreen                    | yes          | forces page-width zoom on enter **and** exit (`eecc89cc`)                                                                                                                                                                                    |
| Search                        | yes          | custom popover: match-case, whole-words, "n of m", Enter / Shift+Enter                                                                                                                                                                       |
| Print                         | yes          | plugin default                                                                                                                                                                                                                               |
| Download                      | yes          | prefers the raw content URL as `<a href download>` — **bypasses the auth hook** (works only if the endpoint accepts the session some other way; unverified)                                                                                  |
| Page navigation UI            | **no**       | scroll only                                                                                                                                                                                                                                  |
| Rotation, thumbnails, sidebar | **no**       |                                                                                                                                                                                                                                              |
| Text selection                | yes          | native text layer; highlight plugin uses `Trigger.None`                                                                                                                                                                                      |
| Scripting in PDFs             | **disabled** | `transformGetDocumentParams={(options) => ({ ...options, isEvalSupported: false })}` (`PdfViewer.tsx:106-107`), commented "Workaround for js-in-pdf (CVE-2024-4367) vulnerability" — production already ships the mitigation FR-026 requires |
| Localisation                  | none         | hard-coded English                                                                                                                                                                                                                           |

### 1.4 Annotation = AI-extraction citation highlights (display-only) — follow-up story input

There are no user-drawn annotations. "Annotation" is the read-only overlay of extraction citations,
shown only in the create flow.

Data source: an extract service (`config.extractServiceBaseUrl`) exposed as a HAL home resource with
HAL-FORMS templates `basic-extract`, `advanced-extract`, `autocomplete`, `classification`. Request:
`{ file, prompt, profile_endpoint, llm_provider?, search_candidates?, process_to_many_relations? }`.

Response shape (condensed from `src/app/api/accessor/ExtractionAccessor.ts:1-77`):

```ts
export type Extraction = { root_entity: string; entities: EntityExtraction[] };
export type AttributeExtraction = {
  value: string | number;
  name: string;
  confidence?: number;
  reason?: string;
  citations?: AttributeCitation[];
};
type AttributeCitation = { citation: string; matches: Annotation[] };
export type Annotation = {
  page: number;
  bbox: {
    // Bounding boxes coords should be given in fractions in contrast to the width/height of the page (with value between 0 and 1).
    // a left value of 0.5 and top value of 0.5 means in the middle of the page.
    left: number;
    top: number;
    width: number;
    height: number;
  };
};
type RelationExtraction = { name: string; ref?: string; refs?: string[] };
export type Candidate = { href: string; confidence: number; matched_attributes: string[] };
type EntityExtraction = {
  id: string;
  attributes: AttributeExtraction[];
  relations: RelationExtraction[];
  entity: string;
  confidence?: number;
  candidate_search?: CandidateSearch;
};
```

Coordinate system: **fractions 0–1, origin top-left, page index 0-based** (renderer filters on
`annot.page === props.pageIndex`, which is 0-based in `@react-pdf-viewer`).

Mapping into the highlight plugin (`PdfViewerExtractionAnnotationRenderer.tsx:28-40`):

```ts
props.getCssProperties(
  {
    height: annot.bbox.height * 100,
    width: annot.bbox.width * 100,
    left: annot.bbox.left * 100,
    top: annot.bbox.top * 100,
    pageIndex: annot.page,
  },
  props.rotation,
);
```

Rendering: one `<div>` per match, `key = entity.id:attr.name:citationIndex:annotationIndex`,
`id = annotation-<entityId>-<attrName>-<citationIndex>` (**citation-scoped, so duplicate DOM ids when a
citation has several matches on one page**), style `{ background: "yellow", opacity: 0.4, cursor:
"pointer", zIndex: 2 }`. Single flat colour; extracted/confirmed state is signalled on the form field
(icon colour, confidence ring, ripple), not on the overlay.

Plugin wiring (`PdfViewer.tsx:70-73`):

```ts
// Trigger.None: annotations are pre-computed by the backend and only displayed, never created from user text selection
const highlightPluginInstance = highlightPlugin({
  renderHighlights: createExtractionAnnotationRenderer(openProperty, extraction),
  trigger: Trigger.None,
});
```

Interactions:

- Click highlight → `openProperty({ propertyName, entityId }, { prefix, citation })` → popover anchored
  on the highlight, showing value / confidence / reason with Apply/Overwrite.
- Click the AI icon on a form field → `openProperty(...)` without annotation → popover synthesises
  citation 0 and a `useLayoutEffect` does `document.getElementById(id).scrollIntoView({ block: "center" })`.
  **Fragile**: if the target page is not mounted by the virtualised viewer the scroll silently no-ops;
  there is no explicit "jump to page" step.
- `CitationNavigation` cycles `citationIndex` with wrap-around (prev/next) — between citations, not
  between matches inside one citation.
- Relations: candidates (`href` + confidence) can be applied/removed instead of a raw value.
- **No write-back**: accepting only edits local form state; the extraction result is discarded after
  the entity `POST`. Nothing about extraction is persisted on the item.

State: `ExtractionContext` (`ExtractionContext.tsx`) with `extraction`, `relevantEntityId`,
`openedProperty`, `annotation: { prefix, citation }`, `fallbackAnchor`, `openProperty(...)`,
`onApplyCandidate`, `onRemoveCandidate`, `getAppliedCandidateHrefs`, plus a child provider that rebinds
`relevantEntityId` for nested relation-search forms.

### 1.5 Rendition service client (condensed from `src/modules/EntityInstance/hooks/rendition-helper.ts`; logic unchanged)

```ts
const renditionTemplateString = getConfig()?.renditionUriTemplate;
const renditionTemplate = renditionTemplateString ? new UriTemplate(renditionTemplateString) : null;
export const renditionsAvailable = !!renditionTemplate;

export async function getRendition(resourceUrl: string): Promise<FileWithMetadata> {
  if (!renditionTemplate) throw new Error("Renditions are not available");
  const resource = renditionTemplate.expand([resourceUrl]);
  const initializeResp = await fetch(createRequest(renditionRequestSpec(resource), {}));
  await checkResponse(initializeResp);
  if (initializeResp.status !== 202)
    throw new Error(`Rendition response has unexpected status ${initializeResp.status}`);
  const renditionUrl = initializeResp.headers.get("location");
  if (!renditionUrl) throw new Error(`Rendition response is missing 'Location' header`);
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const renditionResult = await tryReadRendition(renditionUrl);
    if (renditionResult) return renditionResult;
  }
}
async function tryReadRendition(url: string): Promise<FileWithMetadata | null> {
  const response = await fetch(createRequest(renditionRequestSpec(url), {}));
  await checkResponse(response);
  switch (response.status) {
    case 200:
      return {
        file: await response.blob(),
        filename: "rendition.pdf",
        mimetype: "application/pdf",
      };
    case 202:
      return null; // Rendition not yet ready; retry later
    default:
      throw new Error(`Unexpected status ${response.status}`);
  }
}
export function mustBeRenditioned(mimetype: string) {
  if (mimetype === "application/pdf") return false;
  if (mimetype.startsWith("image/")) return false;
  if (mimetype.startsWith("video/")) return false;
  return true;
}
```

Defaults (`predefinedConfigs.ts:120-124`):
`https://renditions.eu-west-1.contentgrid.cloud/renditions/get/pdf{?url}` (production),
`https://renditions.sandbox.contentgrid.cloud/renditions/get/pdf{?url}` (sandbox).

Observed protocol: `GET <template>?url=<content link>` → **202 + `Location`** → poll every 2 s
**forever** → `200` PDF | `202` pending | other → error. Problem type
`https://contentgrid.cloud/problems/renditions/invalid-conversion` is the only soft failure (falls back
to the raw original → `NoPreview`). `isRendition` drives the caption "Rendering preview...". Any
non-PDF/image/video mimetype (including plain text) is sent to the service.

**Authentication gap**: the shared fetch attaches a Bearer token only when
`request.url.startsWith(apiBaseUrl)` (`authentication.ts:15-31`). The rendition service is on another
origin, so **no user token is sent** to the initial request or the polls. How the service authenticates
to fetch the content URL is unknown from the frontend.

### 1.6 States, config, tests, history

- States: spinner (+ "Rendering preview..." for renditions); `ErrorPreview` with problem-details message
  and raw download link; `DropArea` upload gate when no file and upload allowed; "No file present."
  otherwise; `NoPreview` for unsupported; PDF load errors mapped from `InvalidPDFException`,
  `MissingPDFException`, `UnexpectedResponseException`.
- Config: `extractServiceBaseUrl?` and `renditionUriTemplate?` on `AppConfig`; absent → feature off.
- **Zero tests** in the repo.
- History worth knowing: `2084cbb7` (ACC-2962) blank pages when clicking — highlight plugin intercepted
  selection; first "fix" made the plugin conditional and caused a stuck spinner (`c1669f8b`, ACC-3032);
  real fix is `Trigger.None`, plugin always mounted. `7291d783` (ACC-1716) stale content flashed during
  a slow rendition (`isLoading` vs `isFetching`). Four ACC-1704 commits on viewer height/overflow CSS.
  `429e2e60` fixed duplicate React keys (ids left citation-scoped). `eecc89cc` fullscreen zoom.

### 1.7 Platform documentation

docs.contentgrid.com has no content/rendition reference. The Navigator "Creating entities" guide
states: _"The previewer can natively show PDF's and images, and for other documents, ContentGrid will
attempt to transform the file to PDF."_ and _"the extract feature will also overlay information in the
preview when used."_ Nothing on link relations, the 202/Location contract or authentication.

---

## 2. Imelda frontend (customer delivery — datapoint, not a reference)

Per the team's standing guidance this repo is not a quality benchmark; no code is reproduced here.

- Viewer: `@embedpdf/react-pdf-viewer ^2.5.0` since the first commit; `pdfjs-dist ^5.4.624` used only
  for upload thumbnails. Fetch → `Blob` → object URL → viewer `src`; the `cg:content` link is resolved
  by name; the viewer is wrapped in an error boundary so a third-party crash cannot take the page down.
- Toolbar deliberately minimal: zoom (fit-width default, presets 25–400%, fit-page), download
  (library export command), fullscreen. Everything else disabled via `disabledCategories` (annotation,
  redaction, sidebar, rotate, selection, navigation, print, search, …). No annotation or highlight
  capability of any kind.
- Rendition: same 202 + `Location` + poll contract, but with a **positive list** of Office mimetypes and
  extensions (doc/docx/xls/xlsx/ppt/pptx/rtf/odt/ods/odp), **poll-first-then-wait**, 1.5 s interval,
  **60 s ceiling**, `invalid-conversion` as a soft null, `AbortSignal` cancellation, and the comment
  that `Location` is only readable cross-origin because the service sends
  `Access-Control-Expose-Headers: Location`. Rendition requests are authenticated with an **exchanged
  extension token selected by origin** in the shared auth hook.
- Gotchas found there that apply to any `@embedpdf` host: the viewer renders inside a **shadow DOM**
  (`embedpdf-container`), so (a) theming required injecting a `<style>` into the shadow root via a
  `MutationObserver`, and (b) inside a Radix `Dialog` the `react-remove-scroll` lock cancelled wheel
  events over the viewer until `stopPropagation` was added on a wrapper.
- No tests for the viewer.

---

## 3. Prototype (`contentgrid-navigator-prototype`)

- `@embedpdf/react-pdf-viewer ^2.5.0`, `pdfjs-dist ^5.4.624`; nothing configured for the engine/worker.
- `ContentPreview` in `src/components/entities/entity-detail-card.tsx:58-318`; gate
  `mimetype.startsWith("image/") || mimetype === "application/pdf"`; images via `<img>`, PDFs via
  `<PDFViewer>` with `src` = object URL of an authenticated fetch.
- Toolbar: zoom + download + fullscreen only; `disabledCategories` identical to Imelda's list, so
  annotation, selection, navigation, rotate, sidebar, print, search are all off. Same shadow-DOM style
  injection for focus rings.
- **Anti-pattern to avoid**: `getContentHref()` guesses CURIE rel names (`cg:<attr>`, `d:<attr>`, full
  URLs) by hand — forbidden by this repo's rules; Horizon's `EntityItem.contentLink()` does it right.
- No rendition handling, no annotation, no CVE handling, no tests.

---

## 4. Horizon today (what exists, what is missing)

Exists in `packages/navigator-data`:

- `ProfileAttribute.isContent` (`accessors/attribute-profile.ts:74-78`): `type === object` with embedded
  `blueprint:attribute` children.
- `EntityItem.contentLinks` / `contentLink(attributeName)` (`accessors/entity-item.ts:97, ~369`) from
  `cgRels.content`; `null` when absent (ABAC).
- `EntityItem.downloadContentRequest(attributeName, { range? })` and `uploadContentRequest(...)`
  (`entity-item.ts:402-478`), the documented hand-built-Request exception, with `If-Match` and `Range`.
- `useDownloadContent(entityItem, attributeName)` (`hooks/item/use-content.ts:169-207`) → mutation
  returning `{ blob, mimetype, filename, contentLength, isPartial }` via `contentFetch` (Bearer, no HAL
  Accept header). Blobs are not cached.
- `EntityItemAttributeContent` wraps content values (name, `ContentMetadata | null`, link).
- Env vars **declared but unused**: `VITE_EXTRACT_SERVICE_URL`, `VITE_RENDITION_URI`
  (`packages/navigator-data/src/vite-env.d.ts:6-7`, mirrored in `packages/features`).

Missing:

- Any preview layer: no blob-URL lifecycle hook, no rendition selection/polling, no viewer component.
- The content-focus/attribute-focus branch: `packages/features/src/entity-item/entity-item-view.tsx`
  renders one flat attribute list for every entity; the route
  `apps/navigator/src/routes/_app/$entity/$itemId.tsx` has no viewer logic.
- No `pdf-preview` / `preview` feature folder yet.

Placement rules already decided in the repo: `packages/ui/CLAUDE.md` names `PdfHighlightOverlay` as an
anticipated **pattern**; `packages/features/CLAUDE.md` puts feature-only UI in `packages/features/<feature>/`
and anything touching HAL/hooks in `packages/navigator-data`. ACC-2902 suggests
`packages/ui/src/patterns/pdf-viewer/` (or `packages/features/pdf-preview/` if data-driven); ACC-2903
names `packages/navigator-data/src/preview/rendition-helper.ts`.

---

## 5. Design mockup (page 03 content-focus, page 04 attribute-focus)

- Layout: `grid-template-columns: 1fr 360px` — viewer left, 360 px side panel right. Page 04 drops the
  viewer entirely for a two-column attributes/relations layout. Legend: _"03/04 InstancePage →
  /:entity/:id (content-focus vs attribute-focus chosen by presence of content attribute)"_.
- Toolbar, left to right: content-attribute selector (`ph-files`, "attribute · document") · divider ·
  previous page · **1 / 3** · next page · divider · zoom out · **100%** · zoom in · spacer · replace file
  (`ph-upload-simple`) · download · fullscreen (`ph-arrows-out`). **No search or print** in the mockup;
  ACC-2902 adds them.
- Highlights: `.cf-extract` spans with `--sky-extract: rgba(1,155,227,.16)` background,
  `--sky-extract-ring: rgba(1,155,227,.55)` ring, and an uppercase label tag above (ocean background,
  white text) naming the attribute (`REFERENCE`, `ISSUE_DATE`, `AMOUNT`). Side panel rows carry a
  sparkle "extracted" hint. Amber is reserved for "modified" (user edit) on page 07.
- Side panel header: entity eyebrow, title, path, actions (edit, delete, collapse, fullscreen
  attributes, close).
- Note the tension with §1.2: the mockup draws highlights on the **detail** page, production shows them
  only in the **create** flow and persists nothing. Out of scope for spec 002; the follow-up annotation
  story must settle it.

---

## 6. Jira mapping

Under epic ACC-2835 (Navigator Horizon) the PDF work is already split into tickets. Spec 002 covers the
viewer and rendition tickets; the annotation overlay and the extraction pipeline are a follow-up story:

| Ticket              | Summary                                                           | Status          | Relation to this spec                                                                 |
| ------------------- | ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| ACC-2902            | HZN-6A.1 toolbar: search, print, fullscreen, download, zoom       | **Development** | US1, US3 — check owner before starting                                                |
| ACC-2903            | HZN-6A.2 rendition-aware preview                                  | Open            | US2                                                                                   |
| ACC-2904            | HZN-6A.3 CVE-2024-4367 / scripting posture                        | Open            | FR-026 (reword: see §7)                                                               |
| ACC-2905            | HZN-6A.4 citation navigation UI                                   | Open            | follow-up annotation story                                                            |
| ACC-2906            | HZN-6A.5 video and non-PDF preview                                | Open            | out of scope here                                                                     |
| ACC-2907            | HZN-6B.1 spike: extraction behaviour spec                         | Open            | follow-up annotation story                                                            |
| ACC-2908            | HZN-6B.2 spike: coord-system / annotation API                     | Open            | follow-up annotation story (its stack verdict still reaches spec 002 through ADR-011) |
| ACC-2909            | HZN-6B.3 extract service client                                   | Open            | out of scope (producer)                                                               |
| ACC-2911            | HZN-6B.5 annotation overlay + citation events                     | Open            | follow-up annotation story                                                            |
| ACC-2912            | HZN-6B.6 PropertyExtractionPopover                                | Open            | out of scope (consumer)                                                               |
| ACC-2915/2916/2917  | tests, skipped Playwright test, buffer                            | Open            | plan phase                                                                            |
| ACC-2960            | [docs] Document rendition system                                  | Open            | needed for FR-023                                                                     |
| ACC-3074            | Rendition service 500 instead of 4xx when it cannot fetch content | Open            | affects FR-018 error mapping                                                          |
| ACC-1668            | Rendition kept returning 202 after transform error                | Closed          | motivates the ceiling in FR-017                                                       |
| ACC-2803 / ACC-3169 | Renditions broke on mimetype with parameter                       | Closed          | motivates FR-003 parameter stripping                                                  |

No ticket documents the rendition service API from the consumer's perspective.

---

## 7. Stack state on 2026-09-17 (feeds the plan and ADR-011)

npm registry (stable releases; repo rule: `minimumReleaseAge` 14 days):

| Package                                                                              | Latest                     | Newest allowed today          | Notes                                         |
| ------------------------------------------------------------------------------------ | -------------------------- | ----------------------------- | --------------------------------------------- |
| `@embedpdf/*` (core, engines, react-pdf-viewer, plugin-annotation, plugin-selection) | 2.15.1 (2026-09-16, 0 d)   | **2.15.0** (2026-08-04, 43 d) | MIT; monorepo, all plugins share one version  |
| `pdfjs-dist`                                                                         | 6.3.289 (2026-08-29, 18 d) | 6.3.289                       | Apache-2.0; v6 line — ADR-011 still says "v5" |
| `@react-pdf-viewer/core`                                                             | 3.12.0 (2023-03-21)        | —                             | no release in 3.5 years; custom licence       |

EmbedPDF facts relevant to ADR-011 and the spec:

- **EmbedPDF renders with PDFium compiled to WebAssembly (`@embedpdf/pdfium`, `@embedpdf/engines`), not
  pdf.js.** ADR-011 and ACC-2904 frame the security requirement as "pdf.js v5 disables eval
  (CVE-2024-4367)"; the original Navigator implements it as `isEvalSupported: false` (§1.3). With
  `@embedpdf` the equivalent question is whether the PDFium build has JavaScript (V8) support compiled
  in. Not confirmed from the docs or a repo search in this session → **plan-phase item**; the spec
  states the requirement stack-agnostically (FR-026) and keeps the fixture test.
- Document loading: `openDocumentUrl({ url, password? })` has **no request-header option**;
  `openDocumentBuffer({ buffer: ArrayBuffer, name })` exists, so the authenticated-fetch → bytes → viewer
  pattern is supported (matches FR-005). Events: `onDocumentOpened`, `onDocumentClosed`,
  `onDocumentError`.
- Annotation plugin (`@embedpdf/plugin-annotation`): subtypes include highlight, square, ink, free text,
  stamp; API `useAnnotation(documentId)` → `createAnnotation`, `updateAnnotation`, `deleteAnnotation`,
  `deleteAllAnnotations`, `importAnnotations(AnnotationTransferItem[])`, `exportAnnotations()`,
  `setActiveTool(null)`, `onAnnotationEvent(cb)` with `create|update|delete|loaded`, `flags` including
  `readOnly`, `locked`, `hidden`, `noView`; `<AnnotationLayer scale rotation />`; `autoCommit` config;
  custom tools via `addTool`. **Unit/origin of `rect` not stated in the docs** (likely PDF user-space
  points, origin bottom-left) → mapping from fractional top-left boxes is exactly the HZN-6B.2 spike.
  Whether a hover/click event on an annotation reaches the host without selecting it is also unconfirmed.
- Ready-made viewer (`@embedpdf/react-pdf-viewer`): shadow DOM (see §2 gotchas), `disabledCategories`,
  custom `ui.schema` toolbars, theme tokens, document permission handling
  (`enforceDocumentPermissions`, `useDocumentPermissions()`), `tabBar`. Alternative: the headless
  `@embedpdf/core` plugins with our own shadcn toolbar — avoids the shadow-DOM styling and Radix scroll
  issues and matches the mockup exactly, at the cost of assembling the toolbar ourselves.
- Security docs cover PDF permission flags and encryption only; nothing on script execution or
  untrusted-document sandboxing.

---

## 8. Open questions for `/speckit-clarify` and the plan

Questions 1, 3 and 4 belong to the follow-up annotation story and are recorded here so they are not
lost; 2, 5, 6, 7 and 8 concern spec 002.

1. **Where do highlights appear?** Create flow only (production) or also the detail page (mockup)? The
   latter requires persisting extraction results per item on the platform. → follow-up annotation spec.
2. **Rendition service authentication and contract.** No token (original), exchanged extension token
   (Imelda), or forwarded user token? Is the 202 + `Location` + poll contract and the
   `invalid-conversion` problem type the supported API? Does the service expose `Location` via CORS?
   Owner: platform team; ticket ACC-2960. → **Answered 2026-09-17 (Ranec, via Nick):** the endpoint
   goes in deployment config, and the token exchange comes "for free" from TokenMonger (the platform's
   token-exchange component). Encoded in spec FR-023 and its Clarifications section. Still open: the
   response contract itself (202 + `Location` + poll, `invalid-conversion`) and CORS exposure of
   `Location`. Note Horizon's `packages/navigator-data/src/auth` has no exchange client yet; the plan
   must add one (Imelda's origin-keyed token selection is the reference shape).
3. **PDFium scripting posture** in the `@embedpdf` build (replaces the pdf.js `isEvalSupported` question
   in ADR-011 / ACC-2904). Needed by spec 002's FR-026 as well as by the annotation story. → plan.
4. **Coordinate mapping** from fractional top-left boxes to the `@embedpdf` annotation `rect`
   (units, origin, rotation) and whether the plugin exposes deterministic click targets and hover
   without entering an editing state. If not, ADR-011's fallback (thin custom overlay) applies — and with
   PDFium instead of pdf.js the fallback should be re-evaluated (custom overlay on top of `@embedpdf`'s
   render layer, not a switch to `pdfjs-dist`). → ACC-2908.
5. **Ready-made viewer vs headless plugins.** Shadow DOM theming and Radix scroll-lock interactions
   observed in Imelda/prototype argue for headless + our own toolbar; ACC-2902 assumes plugins either
   way. → plan.
6. **Rendition candidates: positive list or negative rule?** Original: everything not pdf/image/video
   (plain text goes to the service too). Imelda: Office positive list. Spec default (FR-016, US2 sc. 8):
   any non-PDF including missing/generic mimetype, when a service is configured. → confirm with product.
7. **Download of the original when a rendition is shown** is the spec default; confirm.
8. **ADR-011 update**: wording "pdfjs v5" → current versions; CVE framing → engine-specific; record that
   `@react-pdf-viewer` is unmaintained; pin `@embedpdf` to 2.15.0 or older per the 14-day rule.

---

## 9. Behaviours the spec deliberately preserves or fixes

Preserved from production (spec 002): rendition 202/poll flow with `invalid-conversion` as soft
failure; "Rendering preview" caption; no stale content during rendition; fullscreen keeps a sane zoom;
download in every fallback state; scripting disabled in the renderer (`isEvalSupported: false` today,
FR-026 stack-agnostic); text selection; search with match-case / whole-words / Enter / Shift+Enter.

Fixed relative to production (spec 002): explicit page navigation UI (mockup); polling ceiling and
cancellation (no `while(true)`); credentialed download (no raw `<a href>` bypass); rendition
authentication made explicit; mimetype parameters tolerated; scripting-posture test in CI; tests for
the rendition state machine, which had none.

For the follow-up annotation story, preserve: fractional 0–1 top-left coordinates with 0-based pages;
display-only highlights that never intercept selection (`Trigger.None` lesson); click highlight → host
event; field → first citation jump; wrap-around citation navigation. Fix: explicit "go to page, then
scroll" for citations on unrendered pages; unique identity per match (no duplicate DOM ids); tests for
the coordinate mapping.
