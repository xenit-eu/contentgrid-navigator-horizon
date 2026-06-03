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
