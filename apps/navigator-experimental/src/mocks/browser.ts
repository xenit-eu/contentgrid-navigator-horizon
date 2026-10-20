import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";
import { createRelationDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";
import { createContentFocusDemoHandlers } from "./content-focus-handlers";
import { createRenditionDemoHandlers } from "./rendition-handlers";

const origin = window.location.origin;

export const worker = setupWorker(
  // Relation-rich model for the knowledge graph (spec 007). Registered first so its `/profile`
  // root — which also lists the "invoice" and "document" entities — wins the match over the
  // content-focus and demo roots below; those modules' own entity handlers still answer.
  ...createRelationDemoHandlers(origin, {
    extraEntityLinks: [
      { href: `${origin}/profile/invoices`, name: "invoice", title: "Invoice" },
      { href: `${origin}/profile/documents`, name: "document", title: "Document" },
    ],
  }),
  // Registered before createDemoHandlers so its "document" entity handlers are matched.
  ...createContentFocusDemoHandlers(window.location.origin),
  // The second "document" item (a .docx) and the mocked rendition service (US2) — see
  // rendition-handlers.ts for the dev-mode switch (`localStorage["contentgrid-navigator:
  // dev-rendition-mode"]`).
  ...createRenditionDemoHandlers(window.location.origin),
  ...createDemoHandlers(window.location.origin),
);
