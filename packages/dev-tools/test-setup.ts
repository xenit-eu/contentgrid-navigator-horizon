import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Shared MSW server for dev-tools tests. HAL response handlers are
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

// jsdom stubs required by components that use Sidebar / use-mobile / Radix UI

// window.matchMedia — used by @contentgrid/ui Sidebar's use-mobile hook
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ResizeObserver — used by Radix UI Popper inside Sidebar
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Element methods used by Radix UI
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}

// window.scrollTo — used by pagination buttons
window.scrollTo = vi.fn();
