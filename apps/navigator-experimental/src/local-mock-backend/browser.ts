/**
 * DEV-ONLY stand-in for a ContentGrid backend when running `pnpm dev` without one; never
 * bundled into PR previews or production (import gated on `import.meta.env.DEV` in `main.tsx`).
 * To work against a real backend, connect one at `/config` (which disables this mock backend)
 * or set `VITE_USE_MOCK_API=false` + backend vars in `.env.development.local`.
 */
import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";
import { createContentFocusDemoHandlers } from "./content-focus-handlers";
import { createRenditionDemoHandlers } from "./rendition-handlers";

export const worker = setupWorker(
  // Registered first so its own `/profile` root response (listing both the "invoice" and
  // "document" cg:entity links) wins the match over createDemoHandlers' invoice-only one.
  ...createContentFocusDemoHandlers(window.location.origin),
  // The second "document" item (a .docx) and the mocked rendition service (US2) — see
  // rendition-handlers.ts for the dev-mode switch (`localStorage["contentgrid-navigator:
  // dev-rendition-mode"]`).
  ...createRenditionDemoHandlers(window.location.origin),
  ...createDemoHandlers(window.location.origin),
);
