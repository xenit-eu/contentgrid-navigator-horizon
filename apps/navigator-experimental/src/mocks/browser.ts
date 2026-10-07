import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";
import { createContentFocusDemoHandlers } from "./content-focus-handlers";
import { createRenditionDemoHandlers } from "./rendition-handlers";

// `VITE_MOCK_USER=restricted` serves the recorded restricted user (see test-fixtures/recorded/README.md).
const mockUser = import.meta.env.VITE_MOCK_USER === "restricted" ? "restricted" : "full";

export const worker = setupWorker(
  // Registered first so its own `/profile` root response (listing both the "invoice" and
  // "document" cg:entity links) wins the match over createDemoHandlers' invoice-only one.
  ...createContentFocusDemoHandlers(window.location.origin),
  // The second "document" item (a .docx) and the mocked rendition service (US2) — see
  // rendition-handlers.ts for the dev-mode switch (`localStorage["contentgrid-navigator:
  // dev-rendition-mode"]`).
  ...createRenditionDemoHandlers(window.location.origin),
  ...createDemoHandlers(window.location.origin, { user: mockUser }),
);
