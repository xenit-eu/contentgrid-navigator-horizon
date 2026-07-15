import { type HttpHandler, HttpResponse, http } from "msw";
import type { HalFormsTemplateShape } from "@contentgrid/hal-forms/shape";
import type { HalObjectShape, HalSliceShape } from "@contentgrid/hal/shape";
import { invoiceProfileBody, invoiceProfileTemplates, sampleInvoiceItems } from "../hal/fixtures";
import { createProfileHandler } from "./handlers";

function resolveTemplateTargets(
  baseUrl: string,
  templates: Record<string, HalFormsTemplateShape>,
): Record<string, HalFormsTemplateShape> {
  return Object.fromEntries(
    Object.entries(templates).map(([key, tmpl]) => [
      key,
      tmpl.target ? { ...tmpl, target: `${baseUrl}${tmpl.target}` } : tmpl,
    ]),
  );
}

/**
 * Distinctive text shown for the single item on cursor page 2 (see
 * `createInvoicesCursorHandler`). The demo invoice profile has no embedded
 * `blueprint:attribute` list, so `ProfileEntity.userDefinedAttributes` is
 * empty and the entity-browser table falls back to a single `id` column
 * (packages/features/src/entity-browser/entity-detail.tsx — `buildColumns`). That means the `id`
 * field — not `number` — is the only value actually rendered in the table,
 * so it has to carry the recognizable marker text used by the e2e test.
 */
export const PAGE_2_INVOICE_ID = "INVOICE-PAGE2";

/**
 * Cursor-paginated `/invoices` handler used by the e2e cursor-pagination
 * test. MSW matches handlers by path only (query string is ignored), so a
 * single handler serves both pages by branching on the `_cursor` query
 * param — registering two handlers on the same path would only ever hit the
 * first one.
 */
function createInvoicesCursorHandler(baseUrl: string): HttpHandler {
  const collectionUrl = `${baseUrl}/invoices`;
  const page2Url = `${collectionUrl}?_cursor=page2`;

  const page2Item: HalObjectShape<Record<string, unknown>> = {
    ...sampleInvoiceItems[0],
    id: PAGE_2_INVOICE_ID,
    number: PAGE_2_INVOICE_ID,
    _links: { self: { href: `${collectionUrl}/${PAGE_2_INVOICE_ID}` } },
  };

  return http.get(collectionUrl, ({ request }) => {
    const cursor = new URL(request.url).searchParams.get("_cursor");

    if (cursor === "page2") {
      const body: HalSliceShape<Record<string, unknown>> & {
        page: { size: number; total_items_exact: number };
      } = {
        _embedded: { item: [page2Item] },
        _links: {
          self: { href: page2Url },
          prev: { href: collectionUrl },
        },
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      };
      return HttpResponse.json(body);
    }

    const body: HalSliceShape<Record<string, unknown>> & {
      page: { size: number; total_items_exact: number };
    } = {
      _embedded: { item: sampleInvoiceItems },
      _links: {
        self: { href: collectionUrl },
        next: { href: page2Url },
      },
      page: { size: 20, total_items_exact: sampleInvoiceItems.length },
    };
    return HttpResponse.json(body);
  });
}

/**
 * Stubbed ContentGrid HAL endpoint for the app boot smoke tests (HZN-4.7).
 * Serves the profile root, one entity profile, and its collection so an app
 * can discover entities via cg:entity links and render an entity list
 * without a real backend. Used by both apps' dev-mode MSW workers.
 *
 * Resources require a Bearer token (any value), mirroring the platform's
 * 401-on-missing-token behaviour — so the boot smoke test only passes when
 * the auth layer actually attaches the dev token to API requests.
 */
export function createDemoHandlers(baseUrl = "") {
  const requireBearer = (url: string) =>
    http.get(url, ({ request }) => {
      if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
        return HttpResponse.json(
          { type: "https://contentgrid.cloud/problems/unauthorized", status: 401 },
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return undefined; // authorized — fall through to the resource handler below
    });

  return [
    requireBearer(`${baseUrl}/profile`),
    requireBearer(`${baseUrl}/profile/invoices`),
    requireBearer(`${baseUrl}/invoices`),
    http.get(`${baseUrl}/profile`, () =>
      HttpResponse.json({
        _links: {
          self: { href: `${baseUrl}/profile` },
          curies: [
            {
              name: "cg",
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              templated: true,
            },
          ],
          "cg:entity": [{ href: `${baseUrl}/profile/invoices`, name: "invoice", title: "Invoice" }],
        },
      }),
    ),
    createProfileHandler({
      url: `${baseUrl}/profile/invoices`,
      body: invoiceProfileBody,
      templates: resolveTemplateTargets(baseUrl, invoiceProfileTemplates),
    }),
    createInvoicesCursorHandler(baseUrl),
  ];
}
