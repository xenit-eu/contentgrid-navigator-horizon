import { type HttpHandler, HttpResponse, http } from "msw";
import type {
  HalFormsTemplateShape,
  HalObjectWithTemplateShape,
} from "@contentgrid/hal-forms/shape";
import type { HalObjectShape, HalSliceShape, LinksShape } from "@contentgrid/hal/shape";
import { RENDITION_INVALID_CONVERSION } from "../../src/api/problem-details/constants";

// ---- Entity handler ----

export interface EntityHandlerConfig {
  url: string;
  body: HalObjectShape<Record<string, unknown>>;
  templates?: Record<string, HalFormsTemplateShape>;
}

export function createEntityHandler(config: EntityHandlerConfig): HttpHandler {
  return http.get(config.url, () => {
    return HttpResponse.json({
      ...config.body,
      ...(config.templates ? { _templates: config.templates } : {}),
    } satisfies HalObjectWithTemplateShape<Record<string, unknown>, string, unknown, unknown>);
  });
}

// ---- List / collection handler ----

export interface ListHandlerConfig {
  url: string;
  items: HalObjectShape<Record<string, unknown>>[];
  page?: { size: number; total_items_exact: number };
  links?: LinksShape;
}

export function createListHandler(config: ListHandlerConfig): HttpHandler {
  const { url, items, page, links } = config;

  // MSW matches handlers by path only (query strings are ignored), so match
  // against the path and check any query params from `url` explicitly. This
  // lets callers pass a page-specific URL (e.g. with a `_cursor` param) and
  // have it only respond for requests carrying that exact param, instead of
  // registering a handler on a URL containing a query string (which MSW warns
  // is redundant — see https://mswjs.io/docs/http/intercepting-requests#querysearch-parameters).
  const target = new URL(url);
  const path = `${target.origin}${target.pathname}`;
  const expectedParams = [...target.searchParams.entries()];

  return http.get(path, ({ request }) => {
    if (expectedParams.length > 0) {
      const requestParams = new URL(request.url).searchParams;
      const matches = expectedParams.every(([key, value]) => requestParams.get(key) === value);
      if (!matches) {
        return new HttpResponse(null, { status: 404 });
      }
    }

    const body: HalSliceShape<Record<string, unknown>> & {
      page: { size: number; total_items_exact: number };
    } = {
      _embedded: {
        item: items,
      },
      _links: links ?? { self: { href: url } },
      page: page ?? { size: items.length, total_items_exact: items.length },
    };
    return HttpResponse.json(body);
  });
}

// ---- Profile / HAL-FORMS handler ----

export interface ProfileHandlerConfig {
  url: string;
  body: HalObjectShape<Record<string, unknown>>;
  templates: Record<string, HalFormsTemplateShape>;
}

export function createProfileHandler(config: ProfileHandlerConfig): HttpHandler {
  return http.get(config.url, () => {
    return HttpResponse.json({
      ...config.body,
      _templates: config.templates,
    } satisfies HalObjectWithTemplateShape<Record<string, unknown>, string, unknown, unknown>);
  });
}

// ---- Create handler (POST -> 201 + Location) ----

export interface CreateHandlerConfig {
  url: string;
  /** Location header value returned on success. */
  location: string;
  /** HTTP status code. Defaults to 201. */
  status?: number;
}

export function createCreateHandler(config: CreateHandlerConfig): HttpHandler {
  const { url, location, status = 201 } = config;
  return http.post(url, () => {
    return new HttpResponse(null, {
      status,
      headers: { Location: location },
    });
  });
}

// ---- Update handler (PATCH -> configurable status) ----

export interface UpdateHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
  /** Optional response body to return (as JSON). */
  body?: HalObjectShape<Record<string, unknown>>;
  /** Optional ETag to return in the response. */
  etag?: string;
}

export function createUpdateHandler(config: UpdateHandlerConfig): HttpHandler {
  const { url, status = 204, body, etag } = config;
  return http.patch(url, () => {
    const headers: Record<string, string> = {};
    if (etag) headers["ETag"] = etag;
    if (body) {
      return HttpResponse.json(body, { status, headers });
    }
    return new HttpResponse(null, { status, headers });
  });
}

// ---- Delete handler (DELETE -> 204 by default) ----

export interface DeleteHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
}

export function createDeleteHandler(config: DeleteHandlerConfig): HttpHandler {
  const { url, status = 204 } = config;
  return http.delete(url, () => {
    return new HttpResponse(null, { status });
  });
}

// ---- Relation link handler (PUT text/uri-list -> 204) ----

export interface RelationLinkHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
}

export function createRelationLinkHandler(config: RelationLinkHandlerConfig): HttpHandler {
  const { url, status = 204 } = config;
  return http.put(url, () => {
    return new HttpResponse(null, { status });
  });
}

// ---- Relation unlink handler (DELETE -> 204) ----

export interface RelationUnlinkHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
}

export function createRelationUnlinkHandler(config: RelationUnlinkHandlerConfig): HttpHandler {
  const { url, status = 204 } = config;
  return http.delete(url, () => {
    return new HttpResponse(null, { status });
  });
}

// ---- Problem handler (generic RFC 9457 error response) ----

export interface ProblemHandlerConfig {
  method: "get" | "post" | "patch" | "put" | "delete";
  url: string;
  status: number;
  title?: string;
  detail?: string;
  type?: string;
}

export function createProblemHandler(config: ProblemHandlerConfig): HttpHandler {
  const { method, url, status, title, detail, type } = config;
  const body = {
    status,
    title: title ?? "Error",
    ...(detail ? { detail } : {}),
    ...(type ? { type } : {}),
  };
  return http[method](url, () => {
    return HttpResponse.json(body, {
      status,
      headers: { "Content-Type": "application/problem+json" },
    });
  });
}

// ---- Relation add handler (POST text/uri-list -> 204) ----

export interface RelationAddHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
}

export function createRelationAddHandler(config: RelationAddHandlerConfig): HttpHandler {
  const { url, status = 204 } = config;
  return http.post(url, () => {
    return new HttpResponse(null, { status });
  });
}

// ---- Content upload handler (PUT binary -> 204) ----

export interface ContentUploadHandlerConfig {
  url: string;
  /** HTTP status code. Defaults to 204. */
  status?: number;
  /** Optional ETag to return in the response. */
  etag?: string;
}

export function createContentUploadHandler(config: ContentUploadHandlerConfig): HttpHandler {
  const { url, status = 204, etag } = config;
  return http.put(url, () => {
    const headers: Record<string, string> = {};
    if (etag) headers["ETag"] = etag;
    return new HttpResponse(null, { status, headers });
  });
}

// ---- Content download handler (GET binary -> 200 or 206) ----

export interface ContentDownloadHandlerConfig {
  url: string;
  /** The binary content to return. Defaults to an empty Uint8Array. */
  body?: Uint8Array | string;
  /** MIME type for the Content-Type header. Defaults to "application/octet-stream". */
  contentType?: string;
  /** Optional filename for the Content-Disposition header. */
  filename?: string;
  /**
   * When provided, returns 206 Partial Content with a Content-Range header.
   * Format: "bytes start-end/total" e.g. "bytes 0-99/1000".
   */
  contentRange?: string;
}

export function createContentDownloadHandler(config: ContentDownloadHandlerConfig): HttpHandler {
  const {
    url,
    body = new Uint8Array(),
    contentType = "application/octet-stream",
    filename,
    contentRange,
  } = config;

  return http.get(url, () => {
    const status = contentRange ? 206 : 200;
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    if (filename) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }
    if (contentRange) {
      headers["Content-Range"] = contentRange;
    }
    if (typeof body !== "string") {
      headers["Content-Length"] = String(body.length);
    }
    return new HttpResponse(body, { status, headers });
  });
}

// ---- Rendition service handlers (initiate + poll) ----

/** Minimal valid PDF header bytes ("%PDF") — enough to stand in for a rendition body. */
const DEFAULT_RENDITION_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

export interface RenditionHandlersConfig {
  /** The initial rendition-request URL (the expanded `{?url}` template). */
  url: string;
  /** The job URL returned in the initial response's `Location` header, then polled. */
  jobUrl: string;
  /** Number of `202 Accepted` (pending) responses the job URL returns before the outcome. */
  pendingPolls: number;
  /**
   * The terminal outcome after `pendingPolls` polls:
   * - `"ready"`      — `200 application/pdf` with `pdfBytes`.
   * - `"invalid-conversion"` — `application/problem+json`, `type: RENDITION_INVALID_CONVERSION`.
   * - `"error"`      — a generic `application/problem+json` failure (500).
   * - `"never"`      — the job URL always answers `202` (used to exercise the timeout ceiling).
   */
  outcome: "ready" | "invalid-conversion" | "error" | "never";
  /** PDF bytes for the `"ready"` outcome. Defaults to a minimal `%PDF` header. */
  pdfBytes?: Uint8Array;
}

/**
 * Builds the pair of MSW handlers for one simulated rendition job: the initial
 * `GET url` and the polled `GET jobUrl`.
 *
 * Per `contracts/rendition-service.md`, the initial request may answer `200` directly
 * only for the `"ready"` outcome with `pendingPolls: 0` (the "already available"
 * case) — every other outcome, including `"invalid-conversion"`/`"error"` with zero
 * pending polls, goes through the normal `202 + Location` → poll path, so the poll
 * handler is always exercised for those outcomes.
 *
 * `onUnhandledRequest: "error"` (see `test-setup.ts`) means every poll must be
 * matched by a handler — this factory keeps answering the job URL indefinitely
 * (falling back to the terminal response, or to another `202` for `"never"`) rather
 * than only answering a fixed number of times.
 */
export function createRenditionHandlers(config: RenditionHandlersConfig): HttpHandler[] {
  const { url, jobUrl, pendingPolls, outcome, pdfBytes = DEFAULT_RENDITION_PDF_BYTES } = config;

  let remainingPendingPolls = pendingPolls;

  function pendingResponse() {
    return new HttpResponse(null, { status: 202, headers: { Location: jobUrl } });
  }

  function terminalResponse() {
    switch (outcome) {
      case "ready":
        return new HttpResponse(pdfBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(pdfBytes.length),
          },
        });
      case "invalid-conversion":
        return HttpResponse.json(
          {
            status: 422,
            title: "Cannot convert to PDF",
            type: RENDITION_INVALID_CONVERSION,
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      case "error":
        return HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        );
      case "never":
        // No terminal state — keep the job pending forever (used to hit the timeout ceiling).
        return pendingResponse();
    }
  }

  const initialHandler = http.get(url, () => {
    if (pendingPolls === 0 && outcome === "ready") {
      return terminalResponse();
    }
    return pendingResponse();
  });

  const pollHandler = http.get(jobUrl, () => {
    if (outcome === "never") {
      return pendingResponse();
    }
    if (remainingPendingPolls > 0) {
      remainingPendingPolls -= 1;
      return pendingResponse();
    }
    return terminalResponse();
  });

  return [initialHandler, pollHandler];
}
