import { HttpResponse, http } from "msw";
import {
  invoiceProfileBody,
  invoiceProfileTemplates,
  sampleInvoiceItems,
} from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import {
  createListHandler,
  createProfileHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";

/**
 * Stubbed ContentGrid HAL endpoint for the boot smoke test (HZN-4.7).
 * Serves the profile root, one entity profile, and its collection so the
 * app can discover entities via cg:entity links and render an entity list
 * without a real backend.
 */
export const handlers = [
  http.get("/profile", () =>
    HttpResponse.json({
      _links: {
        self: { href: "/profile" },
        curies: [
          {
            name: "cg",
            href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
            templated: true,
          },
        ],
        "cg:entity": [{ href: "/profile/invoices", name: "invoice", title: "Invoice" }],
      },
    }),
  ),
  createProfileHandler({
    url: "/profile/invoices",
    body: invoiceProfileBody,
    templates: invoiceProfileTemplates,
  }),
  createListHandler({
    url: "/invoices",
    items: sampleInvoiceItems,
    page: { size: 20, total_items_exact: sampleInvoiceItems.length },
  }),
];
