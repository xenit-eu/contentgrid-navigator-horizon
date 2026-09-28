import { type HttpHandler, HttpResponse, http } from "msw";
import {
  createContentDownloadHandler,
  createRenditionHandlers,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";

/**
 * The dev-mode rendition outcome, switchable at runtime from the browser devtools console
 * without restarting the dev server or re-registering MSW handlers:
 *
 * ```js
 * localStorage.setItem("contentgrid-navigator:dev-rendition-mode", "never"); location.reload();
 * ```
 *
 * `"ready"` (default) — converts after a couple of `202`s; `"invalid-conversion"` — the rendition
 * service reports it can't convert this file; `"error"` — a generic 500 mid-poll;
 * `"never"` — the job never completes, exercising the polling ceiling (`RenditionTimeoutError`).
 */
export type RenditionDevMode = "ready" | "invalid-conversion" | "never" | "error";
const RENDITION_DEV_MODES: readonly RenditionDevMode[] = [
  "ready",
  "invalid-conversion",
  "never",
  "error",
];
export const RENDITION_DEV_MODE_STORAGE_KEY = "contentgrid-navigator:dev-rendition-mode";
const DEFAULT_RENDITION_DEV_MODE: RenditionDevMode = "ready";

/** A couple of `202`s before the terminal outcome, so "Preparing preview" is actually visible
 * (vs. resolving on the very first poll) — irrelevant for `"never"`, which never reaches one. */
const PENDING_POLLS_BEFORE_OUTCOME = 2;

function readRenditionDevMode(): RenditionDevMode {
  try {
    const stored = localStorage.getItem(RENDITION_DEV_MODE_STORAGE_KEY);
    if ((RENDITION_DEV_MODES as readonly string[]).includes(stored ?? "")) {
      return stored as RenditionDevMode;
    }
  } catch {
    // localStorage unavailable (e.g. a locked-down preview iframe) — fall back to the default.
  }
  return DEFAULT_RENDITION_DEV_MODE;
}

/**
 * Placeholder ".docx" bytes for the Download button — this demo item is never actually opened as
 * a real Word document, only downloaded (bytes) and previewed via the mocked rendition below, so
 * the content itself doesn't need to be a valid OOXML package.
 */
const FIXTURE_DOCX_BYTES = new TextEncoder().encode(
  "This stands in for a .docx file in the dev-mode rendition demo — it is never opened as a real Word document.",
);
const DOCX_MIMETYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Dev-only rendition demo data (spec `002-pdf-viewer`, US2): a second item on the "document"
 * entity (registered by `content-focus-handlers.ts`) holding a `.docx` file instead of a PDF, plus
 * the mocked rendition service endpoint `VITE_RENDITION_URI` points at
 * (`.env.development`: `http://localhost:5174/__mock__/renditions/pdf{?url}`).
 *
 * The *initial* rendition request is a single handler that reads the current dev mode from
 * `localStorage` on every request (so switching modes takes effect immediately, no
 * re-registration) and always answers `202 + Location` pointing at that mode's own job URL; the
 * actual poll/terminal state machine for each mode is `createRenditionHandlers` itself (reused
 * as instructed), one call per mode at that mode's distinct job URL — `createRenditionHandlers`
 * only supports one fixed outcome per registered request URL, so a single shared initial-request
 * handler is what makes the mode switch dynamic without needing four handlers to compete for the
 * same URL.
 */
export function createRenditionDemoHandlers(baseUrl = ""): HttpHandler[] {
  const itemUrl = `${baseUrl}/documents/doc-2`;
  const contentUrl = `${itemUrl}/file`;
  const requestUrl = `${baseUrl}/__mock__/renditions/pdf`;
  const jobUrlForMode = (mode: RenditionDevMode) => `${baseUrl}/__mock__/renditions/jobs/${mode}`;

  const itemBody = {
    id: "doc-2",
    file: { filename: "report.docx", mimetype: DOCX_MIMETYPE, length: FIXTURE_DOCX_BYTES.length },
    _links: {
      self: { href: itemUrl },
      "cg:content": [{ href: contentUrl, name: "file", title: "File" }],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
  };

  const dynamicInitialHandler = http.get(requestUrl, () => {
    const mode = readRenditionDevMode();
    return new HttpResponse(null, { status: 202, headers: { Location: jobUrlForMode(mode) } });
  });

  const pollHandlersPerMode = RENDITION_DEV_MODES.flatMap((mode) => {
    // Only the poll handler (index 1) is used — the initial-request handler `createRenditionHandlers`
    // also returns (index 0) would be registered at the same `requestUrl` for every mode and only
    // the first-registered one would ever be reached; `dynamicInitialHandler` above replaces it.
    const [, pollHandler] = createRenditionHandlers({
      url: requestUrl,
      jobUrl: jobUrlForMode(mode),
      pendingPolls: mode === "never" ? 0 : PENDING_POLLS_BEFORE_OUTCOME,
      outcome: mode,
    });
    return pollHandler;
  });

  return [
    http.get(itemUrl, () => HttpResponse.json(itemBody)),
    createContentDownloadHandler({
      url: contentUrl,
      body: FIXTURE_DOCX_BYTES,
      contentType: DOCX_MIMETYPE,
      filename: "report.docx",
    }),
    dynamicInitialHandler,
    ...pollHandlersPerMode,
  ];
}
