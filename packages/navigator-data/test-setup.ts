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
  // Unmount React trees between tests. Vitest runs without `globals: true`,
  // so RTL's auto-cleanup never registers; without this, mounted hooks keep
  // React's scheduler running after jsdom teardown ("window is not defined").
  cleanup();
});
afterAll(() => server.close());
