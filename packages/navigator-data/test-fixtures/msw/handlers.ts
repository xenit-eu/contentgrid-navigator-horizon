import { type HttpHandler, HttpResponse, http } from "msw";
import type {
  HalFormsTemplateShape,
  HalObjectWithTemplateShape,
} from "@contentgrid/hal-forms/shape";
import type { HalObjectShape, HalSliceShape, LinksShape } from "@contentgrid/hal/shape";

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

  return http.get(url, () => {
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
