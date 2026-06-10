import { HttpResponse, http } from "msw";
import {
  demoInvoiceInv001,
  demoInvoiceInv002,
  demoInvoiceInv003,
  demoInvoiceItems,
  demoInvoiceProfileBody,
  demoInvoiceProfileTemplates,
  demoSupplierItems,
  demoSupplierProfileBody,
  demoSupplierProfileTemplates,
  supplierSup001,
} from "./demo-fixtures";
import { createListHandler } from "./handlers";

/**
 * Stubbed ContentGrid HAL endpoint for the app boot smoke tests (HZN-4.7).
 * Serves the profile root, entity profiles, collections, and item-detail
 * endpoints so the app can discover entities via cg:entity links, render an
 * entity list and an item detail page without a real backend.
 *
 * Resources require a Bearer token (any value), mirroring the platform's
 * 401-on-missing-token behaviour — so the boot smoke test only passes when
 * the auth layer actually attaches the dev token to API requests.
 *
 * Smoke test constraints (apps/navigator/tests/smoke.spec.ts):
 *   – entity "invoice" / title "Invoice"
 *   – collection has exactly 3 items: inv-001, inv-002, inv-003
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
    // ---- Auth guards ----
    requireBearer(`${baseUrl}/profile`),
    requireBearer(`${baseUrl}/profile/invoices`),
    requireBearer(`${baseUrl}/profile/suppliers`),
    requireBearer(`${baseUrl}/invoices`),
    requireBearer(`${baseUrl}/suppliers`),
    requireBearer(`${baseUrl}/invoices/inv-001`),
    requireBearer(`${baseUrl}/invoices/inv-002`),
    requireBearer(`${baseUrl}/invoices/inv-003`),
    requireBearer(`${baseUrl}/suppliers/sup-001`),
    requireBearer(`${baseUrl}/suppliers/sup-002`),
    requireBearer(`${baseUrl}/invoices/inv-001/supplier`),
    requireBearer(`${baseUrl}/invoices/inv-002/supplier`),
    requireBearer(`${baseUrl}/invoices/inv-003/supplier`),
    requireBearer(`${baseUrl}/suppliers/sup-001/invoices`),
    requireBearer(`${baseUrl}/suppliers/sup-002/invoices`),

    // ---- Profile root (cg:entity links for sidebar nav) ----
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
          "cg:entity": [
            { href: `${baseUrl}/profile/invoices`, name: "invoice", title: "Invoice" },
            { href: `${baseUrl}/profile/suppliers`, name: "supplier", title: "Supplier" },
          ],
        },
      }),
    ),

    // ---- Invoice profile (enriched with attributes + content + relation) ----
    http.get(`${baseUrl}/profile/invoices`, () =>
      HttpResponse.json({
        ...demoInvoiceProfileBody,
        _templates: demoInvoiceProfileTemplates,
      }),
    ),

    // ---- Supplier profile ----
    http.get(`${baseUrl}/profile/suppliers`, () =>
      HttpResponse.json({
        ...demoSupplierProfileBody,
        _templates: demoSupplierProfileTemplates,
      }),
    ),

    // ---- Invoice collection ----
    createListHandler({
      url: `${baseUrl}/invoices`,
      items: demoInvoiceItems,
      page: { size: 20, total_items_exact: demoInvoiceItems.length },
    }),

    // ---- Supplier collection ----
    createListHandler({
      url: `${baseUrl}/suppliers`,
      items: demoSupplierItems,
      page: { size: 20, total_items_exact: demoSupplierItems.length },
    }),

    // ---- Invoice item-detail endpoints ----
    http.get(`${baseUrl}/invoices/inv-001`, () =>
      HttpResponse.json(demoInvoiceInv001, {
        headers: { ETag: '"etag-inv-001-v1"' },
      }),
    ),
    http.get(`${baseUrl}/invoices/inv-002`, () =>
      HttpResponse.json(demoInvoiceInv002, {
        headers: { ETag: '"etag-inv-002-v1"' },
      }),
    ),
    http.get(`${baseUrl}/invoices/inv-003`, () =>
      HttpResponse.json(demoInvoiceInv003, {
        headers: { ETag: '"etag-inv-003-v1"' },
      }),
    ),

    // ---- Supplier item-detail endpoints ----
    http.get(`${baseUrl}/suppliers/sup-001`, () =>
      HttpResponse.json(supplierSup001, {
        headers: { ETag: '"etag-sup-001-v1"' },
      }),
    ),
    http.get(`${baseUrl}/suppliers/sup-002`, () =>
      HttpResponse.json(demoSupplierItems[1], {
        headers: { ETag: '"etag-sup-002-v1"' },
      }),
    ),

    // ---- Invoice → supplier relation (to-one: returns single supplier item) ----
    // All 3 demo invoices point to the same supplier for simplicity
    http.get(`${baseUrl}/invoices/inv-001/supplier`, () => HttpResponse.json(supplierSup001)),
    http.get(`${baseUrl}/invoices/inv-002/supplier`, () => HttpResponse.json(supplierSup001)),
    http.get(`${baseUrl}/invoices/inv-003/supplier`, () => HttpResponse.json(demoSupplierItems[1])),

    // ---- Supplier → invoices relation (to-many: returns filtered collection) ----
    createListHandler({
      url: `${baseUrl}/suppliers/sup-001/invoices`,
      items: [demoInvoiceInv001, demoInvoiceInv002],
      page: { size: 20, total_items_exact: 2 },
    }),
    createListHandler({
      url: `${baseUrl}/suppliers/sup-002/invoices`,
      items: [demoInvoiceInv003],
      page: { size: 20, total_items_exact: 1 },
    }),

    // ---- DELETE handlers for demo (return 204) ----
    http.delete(`${baseUrl}/invoices/inv-001`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${baseUrl}/invoices/inv-002`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${baseUrl}/invoices/inv-003`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${baseUrl}/suppliers/sup-001`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${baseUrl}/suppliers/sup-002`, () => new HttpResponse(null, { status: 204 })),
  ];
}
