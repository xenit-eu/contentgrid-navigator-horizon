import { HttpResponse, http } from "msw";
import { invoiceProfileBody, invoiceProfileTemplates, sampleInvoiceItems } from "../hal/fixtures";
import { createListHandler, createProfileHandler } from "./handlers";

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
    requireBearer(`${baseUrl}/`),
    requireBearer(`${baseUrl}/profile`),
    requireBearer(`${baseUrl}/profile/invoices`),
    requireBearer(`${baseUrl}/invoices`),
    // Root resource — cg:entity links point directly at entity collections.
    // fetchProfile fetches this in parallel with /profile to get collection hrefs.
    http.get(`${baseUrl}/`, () =>
      HttpResponse.json({
        _links: {
          self: { href: `${baseUrl}/` },
          curies: [
            {
              name: "cg",
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              templated: true,
            },
          ],
          "cg:entity": [{ href: `${baseUrl}/invoices`, name: "invoice", title: "Invoice" }],
        },
      }),
    ),
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
      templates: invoiceProfileTemplates,
    }),
    createListHandler({
      url: `${baseUrl}/invoices`,
      items: sampleInvoiceItems,
      page: { size: 20, total_items_exact: sampleInvoiceItems.length },
    }),
  ];
}
