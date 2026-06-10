import { HttpResponse, http } from "msw";
import { invoiceProfileBody, invoiceProfileTemplates, sampleInvoiceItems } from "../hal/fixtures";
import { createListHandler, createProfileHandler } from "./handlers";

/**
 * Stubbed ContentGrid HAL endpoint for the app boot smoke tests (HZN-4.7).
 * Serves the profile root, one entity profile, and its collection so an app
 * can discover entities via cg:entity links and render an entity list
 * without a real backend. Used by both apps' dev-mode MSW workers.
 */
export function createDemoHandlers(baseUrl = "") {
  return [
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
