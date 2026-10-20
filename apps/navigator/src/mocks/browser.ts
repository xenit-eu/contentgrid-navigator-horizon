import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";
import { createRelationDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";

const origin = window.location.origin;

export const worker = setupWorker(
  // Relation-rich model for the knowledge graph (spec 007: customers, orders, products, …).
  // Registered first so its `/profile` root — which also lists the invoice entity below — wins the
  // match over createDemoHandlers' invoice-only root.
  ...createRelationDemoHandlers(origin, {
    extraEntityLinks: [{ href: `${origin}/profile/invoices`, name: "invoice", title: "Invoice" }],
  }),
  ...createDemoHandlers(origin),
);
