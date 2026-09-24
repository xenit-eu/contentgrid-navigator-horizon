import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

// Shared MSW server for navigator-data tests. HAL response handlers are
// registered per-test (or via a shared handlers module in HZN-2.4).
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
  server.resetHandlers();
  // Unmount React trees between tests, mirroring packages/features/test-setup.ts.
  cleanup();
  // React's scheduler queues `performWorkUntilDeadline` on a macrotask (it prefers Node's
  // `setImmediate` over MessageChannel when both exist, as they do under Vitest + jsdom).
  // Anything still queued when Vitest tears the jsdom environment down runs against a deleted
  // `window` and surfaces as an unhandled "ReferenceError: window is not defined" from
  // react-dom — which fails the whole run (Vitest exits non-zero on unhandled errors) even
  // though every test passed. Yielding two event-loop turns here drains that queue while
  // `window` is still alive. `setTimeout` rather than `setImmediate` because this package's
  // tsconfig does not pull in Node's globals.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
});
afterAll(() => server.close());
