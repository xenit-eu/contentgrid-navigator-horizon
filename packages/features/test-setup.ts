import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

// Shared MSW server for feature tests. HAL response handlers are
// registered per-test, mirroring packages/navigator-data/test-setup.ts.
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // Unmount React trees between tests to prevent DOM leakage. Without this,
  // rendered components from one test can bleed into subsequent tests and
  // cause "Found multiple elements" failures when multiple tests share the
  // same descriptive text strings.
  cleanup();
});
afterAll(() => server.close());

// jsdom does not implement window.matchMedia, which SidebarProvider uses
// (via the useIsMobile hook). Without this stub the Sidebar crashes during
// render and React's error boundary replaces the whole tree with
// "Something went wrong!", making every entity-list test fail.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
