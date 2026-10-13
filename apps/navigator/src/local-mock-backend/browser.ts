/**
 * DEV-ONLY stand-in for a ContentGrid backend when running `pnpm dev` without one; never
 * bundled into PR previews or production (import gated on `import.meta.env.DEV` in `main.tsx`).
 * To work against a real backend, connect one at `/config` (which disables this mock backend)
 * or set `VITE_USE_MOCK_API=false` + backend vars in `.env.development.local`.
 */
import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";

export const worker = setupWorker(...createDemoHandlers(window.location.origin));
