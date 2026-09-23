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
  // Unmount renderHook trees between tests. Without this, a hook left mounted after
  // its test ends can still have pending async work (e.g. a delayed MSW response)
  // that resolves after the test file's jsdom environment is torn down, throwing
  // "window is not defined" from inside React's scheduler.
  cleanup();
});
afterAll(() => server.close());
