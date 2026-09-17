# Research: PDF viewer and rendition preview

**Feature**: [`spec.md`](spec.md) | **Date**: 2026-09-17 | **Purpose**: record how the existing
implementations behave and what the current stack offers, so the spec is grounded and `/speckit-plan`
does not have to rediscover it. This file is input to the plan; it contains no requirements.

Sources examined (all read-only):

| Source                      | Location                                                                     | State examined                    |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| Original Navigator          | `xenit-eu/contentgrid-navigator`, local clone `~/CODE/contentgrid-navigator` | `main` at `a8195446` (2026-09-16) |
| Prototype                   | `~/CODE/contentgrid-navigator-prototype`                                     | `c3c0e91` (2026-03-18)            |
| Horizon (this repo)         | `packages/navigator-data`, `packages/features`, `apps/navigator`             | `main` at `35ff6b1e`              |
| Design mockup               | `~/Downloads/contentgrid-navigator-mockup 2.html`, pages 03/04               | 2026-06-10                        |
| npm registry, EmbedPDF docs | see §5                                                                       | 2026-09-17                        |

The code excerpts below are condensed from the sources (logic unchanged, formatting compacted;
`path:line` points at the real source). The annotation / extraction-highlight overlay is out of scope
for this spec; its research was removed from this file at review and remains in this branch's git
history (commit 579bd325).

---

## 1. Original Navigator (production behaviour to reproduce)

### 1.1 Stack

- `pdfjs-dist ^3.3.122` (resolved 3.11.174), `@react-pdf-viewer/core|default-layout|highlight ^3.11–3.12`,
  plus **undeclared** transitive imports of `@react-pdf-viewer/toolbar|zoom|get-file|print|full-screen|search`.
  `@react-pdf-viewer` has had **no release since 2023-03** (see §5) — not a viable base.
- One global pdf.js worker for the app lifetime: `<Worker workerUrl={pdfWorkerUrl}>` wraps the whole
  authenticated tree (`src/app/App.tsx:110-121`).

### 1.2 Structure and gating

```
src/modules/FileViewer/
  components/EntityInstanceFiles.tsx            content-attribute selector, close/open-in-window
  components/FileViewerContentRenderer.tsx      loading / error / empty / upload gate
  components/FilePreview.tsx                    mimetype → PdfViewer | ImagePreview | VideoPlayer | NoPreview
  components/PdfViewer.tsx                      @react-pdf-viewer wiring + toolbar
  components/DropArea.tsx                       drag-and-drop upload shown when no file is present
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

Empty state: when the attribute holds no file and an `onUpload` handler is provided, `DropArea` renders a
drag-and-drop upload zone in the viewer area (`FileViewerContentRenderer.tsx:35-41`); otherwise the static
text "No file present." (`:43-48`).

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
| Text selection                | yes          | native text layer                                                                                                                                                                                                                            |
| Scripting in PDFs             | **disabled** | `transformGetDocumentParams={(options) => ({ ...options, isEvalSupported: false })}` (`PdfViewer.tsx:106-107`), commented "Workaround for js-in-pdf (CVE-2024-4367) vulnerability" — production already ships the mitigation FR-026 requires |
| Localisation                  | none         | hard-coded English                                                                                                                                                                                                                           |

### 1.4 Rendition service client (condensed from `src/modules/EntityInstance/hooks/rendition-helper.ts`; logic unchanged)

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
origin, so **no user token is sent** to the initial request or the polls. Resolved for the new
implementation in §6, question 1. Note for the implementation: the job `Location` header is only
readable cross-origin if the service sends `Access-Control-Expose-Headers: Location`; confirm with the
platform team (ACC-2960).

### 1.5 States, config, tests, history

- States: spinner (+ "Rendering preview..." for renditions); `ErrorPreview` with problem-details message
  and raw download link; `DropArea` upload gate when no file and upload allowed; "No file present."
  otherwise; `NoPreview` for unsupported; PDF load errors mapped from `InvalidPDFException`,
  `MissingPDFException`, `UnexpectedResponseException`.
- Config: `renditionUriTemplate?` on `AppConfig`; absent → renditions off, non-PDF content falls to
  `NoPreview`.
- **Zero tests** in the repo.
- History worth knowing: `2084cbb7` (ACC-2962) blank pages when clicking around a PDF — caused by the
  highlight plugin intercepting text selection; a first "fix" that mounted the plugin conditionally
  caused a stuck spinner (`c1669f8b`, ACC-3032). Lesson for any viewer: never swap the plugin set of a
  mounted viewer. `7291d783` (ACC-1716) stale content flashed during a slow rendition (`isLoading` vs
  `isFetching`). Four ACC-1704 commits on viewer height/overflow CSS. `eecc89cc` fullscreen zoom.

### 1.6 Platform documentation

docs.contentgrid.com has no content/rendition reference. The Navigator "Creating entities" guide
states: _"The previewer can natively show PDF's and images, and for other documents, ContentGrid will
attempt to transform the file to PDF."_ Nothing on link relations, the 202/Location contract or
authentication.

---

## 2. Prototype (`contentgrid-navigator-prototype`)

- `@embedpdf/react-pdf-viewer ^2.5.0`, `pdfjs-dist ^5.4.624`; nothing configured for the engine/worker.
- `ContentPreview` in `src/components/entities/entity-detail-card.tsx:58-318`; gate
  `mimetype.startsWith("image/") || mimetype === "application/pdf"`; images via `<img>`, PDFs via
  `<PDFViewer>` with `src` = object URL of an authenticated fetch.
- Toolbar: zoom + download + fullscreen only; `disabledCategories` turns off annotation, redaction,
  selection, navigation, rotate, sidebar, print and search. Same shadow-DOM style injection
  for focus rings.
- **Anti-pattern to avoid**: `getContentHref()` guesses CURIE rel names (`cg:<attr>`, `d:<attr>`, full
  URLs) by hand — forbidden by this repo's rules; Horizon's `EntityItem.contentLink()` does it right.
- No rendition handling, no scripting-posture handling, no tests.

---

## 3. Horizon today (what exists, what is missing)

Exists in `packages/navigator-data`:

- `ProfileAttribute.isContent` (`accessors/attribute-profile.ts:74-78`): `type === object` with embedded
  `blueprint:attribute` children.
- `EntityItem.contentLinks` / `contentLink(attributeName)` (`accessors/entity-item.ts:97, ~369`) from
  `cgRels.content`.
- `EntityItem.downloadContentRequest(attributeName, { range? })` and `uploadContentRequest(...)`
  (`entity-item.ts:402-478`), the documented hand-built-Request exception, with `If-Match` and `Range`.
- `useDownloadContent(entityItem, attributeName)` (`hooks/item/use-content.ts:169-207`) → mutation
  returning `{ blob, mimetype, filename, contentLength, isPartial }` via `contentFetch` (Bearer, no HAL
  Accept header). Blobs are not cached.
- `EntityItemAttributeContent` wraps content values (name, `ContentMetadata | null`, link).
- Env vars **declared but unused**: `VITE_EXTRACT_SERVICE_URL`, `VITE_RENDITION_URI`
  (`packages/navigator-data/src/vite-env.d.ts:6-7`, mirrored in `packages/features`).
- `packages/navigator-data/src/auth` has **no token-exchange client** yet (`auth-config.ts`,
  `token-supplier.ts`, `use-app-auth.ts`, dev-token helpers only).

Missing:

- Any preview layer: no blob-URL lifecycle hook, no rendition selection/polling, no viewer component.
- A token-exchange client for the rendition service's origin (§6, question 1).
- The content-focus/attribute-focus branch: `packages/features/src/entity-item/entity-item-view.tsx`
  renders one flat attribute list for every entity; the route
  `apps/navigator/src/routes/_app/$entity/$itemId.tsx` has no viewer logic.
- No `pdf-preview` / `preview` feature folder yet.

Placement rules already decided in the repo: `packages/features/CLAUDE.md` puts feature-only UI in
`packages/features/<feature>/` and anything touching HAL/hooks in `packages/navigator-data`. ACC-2902
suggests `packages/ui/src/patterns/pdf-viewer/` (or `packages/features/pdf-preview/` if data-driven);
ACC-2903 names `packages/navigator-data/src/preview/rendition-helper.ts`.

---

## 4. Design mockup (page 03 content-focus, page 04 attribute-focus)

- Layout: `grid-template-columns: 1fr 360px` — viewer left, 360 px side panel right. Page 04 drops the
  viewer entirely for a two-column attributes/relations layout. Legend: _"03/04 InstancePage →
  /:entity/:id (content-focus vs attribute-focus chosen by presence of content attribute)"_.
- Toolbar, left to right: content-attribute selector (`ph-files`, "attribute · document") · divider ·
  previous page · **1 / 3** · next page · divider · zoom out · **100%** · zoom in · spacer · replace file
  (`ph-upload-simple`) · download · fullscreen (`ph-arrows-out`). **No search or print** in the mockup;
  ACC-2902 adds them.
- Side panel header: entity eyebrow, title, path, actions (edit, delete, collapse, fullscreen
  attributes, close).

---

## 5. Stack state on 2026-09-17 (feeds the plan and ADR-011)

npm registry (stable releases; repo rule: `minimumReleaseAge` 14 days):

| Package                                                              | Latest                     | Newest allowed today          | Notes                                         |
| -------------------------------------------------------------------- | -------------------------- | ----------------------------- | --------------------------------------------- |
| `@embedpdf/*` (core, engines, react-pdf-viewer, plugin-selection, …) | 2.15.1 (2026-09-16, 0 d)   | **2.15.0** (2026-08-04, 43 d) | MIT; monorepo, all plugins share one version  |
| `pdfjs-dist`                                                         | 6.3.289 (2026-08-29, 18 d) | 6.3.289                       | Apache-2.0; v6 line — ADR-011 still says "v5" |
| `@react-pdf-viewer/core`                                             | 3.12.0 (2023-03-21)        | —                             | no release in 3.5 years; custom licence       |

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
- Ready-made viewer (`@embedpdf/react-pdf-viewer`): renders inside a shadow DOM (`embedpdf-container`),
  `disabledCategories`,
  custom `ui.schema` toolbars, theme tokens, document permission handling
  (`enforceDocumentPermissions`, `useDocumentPermissions()`), `tabBar`. Known integration gotchas of the shadow DOM: theming needs a `<style>` injected into the shadow root, and inside a Radix `Dialog` the `react-remove-scroll` lock cancels wheel events over the viewer unless a wrapper stops propagation. Alternative: the headless `@embedpdf/core` plugins with our own shadcn toolbar — avoids both issues and matches the mockup exactly, at the cost of assembling the toolbar ourselves.
- Security docs cover PDF permission flags and encryption only; nothing on script execution or
  untrusted-document sandboxing.

---

## 6. Open questions for the plan

1. **Rendition service authentication and endpoint** — **answered 2026-09-17** (platform side): the
   endpoint goes in deployment configuration (`VITE_RENDITION_URI` / Liaison, not a HAL link) and the
   token exchange comes "for free" from TokenMonger, the platform's token-exchange component. Encoded in
   spec FR-023 and its Clarifications section. Still to confirm with the platform team: the response
   contract itself (202 + `Location` + poll, `invalid-conversion`) and CORS exposure of `Location`
   (ticket ACC-2960). Horizon has no exchange client yet (§3); an origin-keyed token selection in the
   shared auth hook is the natural shape.
2. **PDFium scripting posture** in the `@embedpdf` build (replaces the pdf.js `isEvalSupported` question
   in ADR-011 / ACC-2904). Needed by FR-026. → plan.
3. **Ready-made viewer vs headless plugins.** The shadow-DOM theming and Radix scroll-lock gotchas (§5)
   and the prototype's style-injection workaround argue for headless + our own toolbar; ACC-2902 assumes
   plugins either way. → plan.
4. **Rendition candidates: positive list or negative rule?** Original: everything not pdf/image/video
   (plain text goes to the service too). Alternative: an Office positive list (doc/docx/xls/xlsx/ppt/pptx/
   rtf/odt/ods/odp). Spec default (FR-016,
   US2 sc. 8): any non-PDF including missing/generic mimetype, when a service is configured. → confirm
   with product.
5. **Download of the original when a rendition is shown** is the spec default; confirm.
6. **ADR-011 update**: wording "pdfjs v5" → current versions; CVE framing → engine-specific; record that
   `@react-pdf-viewer` is unmaintained; pin `@embedpdf` to 2.15.0 or older per the 14-day rule.

---

## 7. Behaviours the spec deliberately preserves or fixes

Preserved from production: rendition 202/poll flow with `invalid-conversion` as soft failure; "Rendering
preview" caption; no stale content during rendition; fullscreen keeps a sane zoom; download in every
fallback state; drag-and-drop upload area in the empty state; scripting disabled in the renderer
(`isEvalSupported: false` today, FR-026 stack-agnostic); text selection; search with match-case /
whole-words / Enter / Shift+Enter.

Fixed relative to production: explicit page navigation UI (mockup); polling ceiling and cancellation
(no `while(true)`); credentialed download (no raw `<a href>` bypass); rendition authentication made
explicit (TokenMonger exchange); mimetype parameters tolerated; scripting-posture test in CI; tests for
the rendition state machine, which had none.
