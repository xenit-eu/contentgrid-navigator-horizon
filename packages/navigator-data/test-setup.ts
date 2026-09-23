import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

// Shared MSW server for navigator-data tests. HAL response handlers are
// registered per-test (or via a shared handlers module in HZN-2.4).
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // Unmount React trees between tests, mirroring packages/features/test-setup.ts.
  // Without this every `renderHook` stays mounted for the rest of the file, and
  // React's scheduler can still have work queued via setImmediate when the jsdom
  // environment is torn down — surfacing as an unhandled
  // "ReferenceError: window is not defined" that fails the run while every test passes.
  cleanup();
});
afterAll(() => server.close());
