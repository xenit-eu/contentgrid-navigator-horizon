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

Missing:

- Any preview layer: no blob-URL lifecycle hook, no rendition selection/polling, no viewer component.
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

1. **Rendition service authentication and endpoint** — **answered 2026-09-17** (platform side, relayed
   by Nick): the endpoint goes in deployment configuration (`VITE_RENDITION_URI` / Liaison, not a HAL
   link) and "TokenMonger takes care of" the exchange — on the platform side, for the rendition service.
   The frontend performs no exchange: it calls the configured endpoint with the same authenticated
   content client it uses for downloads (user's access token). Encoded in spec FR-023 and its
   Clarifications section. Still to confirm with the platform team: that the service accepts the user's
   token for this realm, CORS for the Navigator origin, and the response contract itself (202 +
   `Location` + poll, `invalid-conversion`) — ticket ACC-2960.
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
(no `while(true)`); credentialed download (no raw `<a href>` bypass); rendition requests authenticated with the user's
credentials (no exchange in the frontend); mimetype parameters tolerated; scripting-posture test in CI; tests for
the rendition state machine, which had none.

---

## 8. Plan-phase decisions (Phase 0 of `/speckit-plan`, 2026-09-17)

Each entry: Decision / Rationale / Alternatives considered. Sources: the codebase (paths cited), the
npm registry and jsDelivr file listings for `@embedpdf/*@2.15.0`, and the EmbedPDF docs and issue tracker.

### 8.1 Viewer: headless `@embedpdf/core` + plugins, not `@embedpdf/react-pdf-viewer`

- **Decision**: build the viewer from `@embedpdf/core` (`EmbedPDF` provider, `usePdfiumEngine`) plus
  `plugin-document-manager`, `plugin-viewport`, `plugin-scroll`, `plugin-render`, `plugin-zoom`,
  `plugin-search`, `plugin-print`, `plugin-selection` (+ `plugin-interaction-manager` peer); the toolbar
  is ours, in shadcn primitives. Fullscreen via the native Fullscreen API on our layout element.
- **Rationale**: the drop-in viewer injects every stylesheet at runtime without nonce support (open
  issue #818) and breaks under a strict `style-src`; it renders in a shadow DOM (theming needs style
  injection, Radix scroll-lock cancels wheel events — see §5); it pulls `@embedpdf/snippet` (~9.7 MB
  unpacked, 30+ plugins) while we need eight; the mockup toolbar (§4) is only reachable exactly with our
  own controls; ADR-011 keeps `@embedpdf` as the stack, this is the headless entry of the same family.
- **Alternatives**: drop-in `react-pdf-viewer` (rejected for the reasons above); vanilla `pdfjs-dist` 6
  (ADR-011's fallback: more DIY, no reason to trigger it — the trigger conditions concern annotations,
  which are out of scope here); `react-pdf` (highlight story irrelevant here, but no advantage over
  pdf.js direct).
- **Facts**: all packages exist at 2.15.0/2.15.1, no `postinstall`/`install` scripts (nothing for
  `onlyBuiltDependencies`), peer `react >=16.8` (`plugin-print` `>=18`), ESM + CJS, `exports` maps.
  Known open issues to design around: `useScroll().state.totalPages` stays 0 if mounted before the
  document opens (#691) → mount page controls after `onDocumentOpened`; drag selection state not
  persisted (#707) → verify FR-010 copy in the browser; `closeDocument()` on a loading doc leaks (#754) →
  close only after open or on unmount with a guard; `usePdfiumEngine` needs a Strict-Mode guard (#700).
  `plugin-search`/`plugin-fullscreen` have no docs pages; APIs read from `dist` (`useSearch(documentId)`
  → `state.total`, `activeResultIndex`, `provides.nextResult/previousResult/goToResult/setFlags(MatchFlag[])`;
  exact `MatchFlag` members to confirm in a task).

### 8.2 WASM and worker: self-hosted, absolute URL, `blob:` worker, fonts off

- **Decision**: import `@embedpdf/pdfium/pdfium.wasm?url` in the feature (Vite emits a hashed
  asset — **not** `.../dist/pdfium.wasm?url`: the package's `exports` map only publishes the
  `./pdfium.wasm` subpath, even though that isn't the file's real on-disk location, and the
  `dist/...` path 404s under Vite/Rolldown's `exports`-conditions resolution, confirmed while
  building `packages/ui`'s Storybook — see `packages/ui/CLAUDE.md`), turn it absolute with
  `new URL(url, window.location.href).href`, pass it as `wasmUrl` to
  `usePdfiumEngine({ wasmUrl, worker: true })`; set `fontFallback: { fonts: {} }` (not `null`, see
  #631) so no glyph fonts are fetched from jsDelivr; document `worker-src blob:` (and `connect-src`
  for the rendition origin) as CSP requirements for deployment.
- **Rationale**: FR-027 forbids CDN assets; `@embedpdf/engines` defaults to
  `https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@<v>/dist/pdfium.wasm`; the worker is created as a
  `blob:` module worker with no external-URL option yet (#628/#634 open); a relative `wasmUrl` breaks
  inside that worker (#633). No `SharedArrayBuffer`/COOP-COEP requirement found (plain
  `fetch`+`instantiate`); treat as to-be-verified in the quickstart.
- **Alternatives**: `vite-plugin-static-copy` (extra dependency for what `?url` gives us); hosting the
  wasm in `public/` per app (duplicated 4.4 MB per app, manual version sync).
- **Size**: `pdfium.wasm` ≈ 4.4 MB (4,633,788 B). Lazy-load the viewer chunk on content-focus pages only;
  hashed asset + long-lived caching keeps SC-001 achievable after the first visit; first visit on a
  20 Mbit/s link is ≈ 1.8 s for the wasm plus the document.

### 8.3 Rendition authentication: the user's credentials, no exchange in the frontend

- **Decision**: rendition requests (initial and polls) go through the existing `contentFetch`, so they
  carry the user's access token in the `Authorization` header exactly like content downloads. The
  frontend does not exchange tokens; TokenMonger performs whatever exchange the rendition service needs
  on the platform side ("TokenMonger takes care of this", Nick, 2026-09-17, correcting an earlier
  reading of Ranec's answer). No new fetch client, no token cache, no exchange endpoint in config.
- **Rationale**: the platform owns extension authentication; the frontend's job is only to identify the
  user. `contentFetch` already attaches the Bearer token for any URL (the current supplier does not
  filter by origin), so the rendition origin receives it without new code.
- **Alternatives**: a frontend-side exchange via `@contentgrid/fetch-hook-authentication`'s
  `createContentgridTokenExchangeTokenSupplier` (rejected by the product owner as not how the platform
  works; kept in git history of this branch if the platform ever requires it); no credentials (the
  original Navigator's accidental behaviour; rejected: the service has an authentication module,
  ACC-2309).
- **Open**: confirm with the platform team that the rendition service accepts the user's token for the
  Navigator realm and allows the Navigator origin (CORS, `Authorization`, `Location` exposure) — ACC-2960.

### 8.4 Preview source as one TanStack Query with an abortable long-poll `queryFn`

- **Decision**: `useContentPreview(entityItem, attributeName)` runs a single `useQuery` keyed
  `queryKeys.contentPreview.byUrl(link.href, entityItem.etag)`; `queryFn({ signal })` returns a
  `PreviewSource`: stored PDF → `contentFetch(downloadContentRequest)` → bytes; non-PDF and
  `renditionUri` configured → `requestRendition(contentFetch, uriTemplate, link.href, { signal,
intervalMs, timeoutMs })` → bytes, or `{ kind: "unsupported" }` on `RENDITION_INVALID_CONVERSION`;
  non-PDF without configuration → `{ kind: "unavailable" }`; 404 → `{ kind: "noFile" }`. `retry: false`,
  `staleTime: Infinity`, `gcTime: 5 min`. Polling honours the query's `signal`, so switching attribute
  or leaving the page aborts the loop (FR-021); the ceiling throws a typed `RenditionTimeoutError`
  (FR-017). Retry = `refetch()`.
- **Rationale**: one owner for loading/error/cancel; the ETag in the key invalidates the preview when a
  new file is uploaded; `useDownloadContent` stays a mutation for the Download action (FR-012), so no
  behaviour change for existing callers; `refetchInterval` polling was rejected because the job URL is
  discovered mid-flight and the terminal state must be decided by status code, not by data shape.
- **Alternatives**: a hand-written reducer/state machine hook (more code, no cache, no dedupe between the
  panel and a future thumbnail); a mutation (no cancellation on unmount, no reuse across remounts such as
  fullscreen toggles).

### 8.5 Placement and stability path

- **Decision**: viewer + toolbar = `packages/ui/src/patterns/pdf-viewer/` (plain props: `bytes`,
  `filename`, `wasmUrl`, toolbar toggles, `onDownload`, `onDocumentOpened`, `onLoadError`,
  `onProtected`); data + protocol = `navigator-data` (`preview/`, `hooks/preview/`);
  layout, selector, panel, frame, view = new feature `packages/features/src/entity-item-content-focus/`
  with `x-stability: experimental`, mounted by `apps/navigator-experimental`. Promotion: move the FR-001
  branch and panel into `entity-item`, flip the app route, delete the wrapper feature.
- **Rationale**: `entity-item` is already `stable` and may not import experimental code; the pattern is
  reused by the annotation follow-up and the create flow; `packages/ui/CLAUDE.md` already anticipates
  PDF patterns; ACC-2902 proposes the same path.
- **Alternatives**: a `pdf-preview` feature holding the viewer (would block reuse from the create flow
  without a features→features import); modifying `entity-item` directly (stability regression).

### 8.6 Configuration

- **Decision**: reuse `RuntimeAppConfig.renditionUri` (exists, unused) as a URI template
  (`…/renditions/get/pdf{?url}`); add `renditionPollIntervalMs?` (default 2000),
  `renditionTimeoutMs?` (default 60000); extend `ContentGridConfigSchema` so Liaison's `config.js`
  `v1.renditionUri` is honoured (today only `import.meta.env.VITE_RENDITION_URI` is read, i.e. build-time);
  no new `VITE_*` variables. `NavigatorDataContextValue` gains optional `renditionUri` and
  `renditionPolling`; `makeWrapper()` in tests gains matching optional parameters.
- **Rationale**: FR-029 wants deployment configuration; `apiBaseUrl`/OIDC already flow through Liaison,
  the rendition URL should too. Liaison delivering `renditionUri` is a platform task (dependency).

### 8.7 Problem types and states

- **Decision**: add `RENDITION_INVALID_CONVERSION = "https://contentgrid.cloud/problems/renditions/invalid-conversion"`
  to the typed problem constants and match it with `isProblemOfType`; map it to the non-error
  "Preview not available" state. Other rendition failures (5xx, timeout, network) are error states rendered
  through `toProblemDisplayModel` → `ProblemAlert` (generic kind) with Retry. No new `ProblemDisplayModel`
  kind is needed. ACC-3074 (500 where a 4xx belongs) is handled by the generic path.
- **Alternatives**: string-matching the URI in the hook (rejected: repo treats problem types as typed).

### 8.8 Testing approach

- **Decision**: hooks, client, state machine and util in Vitest + MSW (`Uint8Array` bodies, never
  `new Response(blob)`; fake timers to flush the poll interval; `onUnhandledRequest: "error"` means one
  handler per poll); the viewer itself cannot run PDFium in jsdom, so rendering, toolbar behaviour, the
  scripting fixture (FR-026) and accessibility run as Storybook stories with `play()` under Playwright
  (`pnpm test:visual`, `pnpm test:a11y`); one e2e scenario in `apps/navigator/tests/e2e` reuses
  `fixtures/Bob.pdf` (checked: 1 page, 330 kB — a 20-page fixture must be added for SC-001). Fixtures:
  `test-fixtures/pdf/minimal.pdf` (1 page) and `js-in-pdf.pdf` (an `OpenAction` JavaScript that would
  call `app.alert`), committed as binaries.
