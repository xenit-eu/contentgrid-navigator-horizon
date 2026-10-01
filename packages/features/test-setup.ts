import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

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
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}

// window.scrollTo — used by pagination buttons
window.scrollTo = vi.fn();

// React Flow (@xyflow/react, knowledge-graph pattern) needs a few layout APIs
// jsdom lacks. Mirrors `mockReactFlow()` from the React Flow testing guide
// (https://reactflow.dev/learn/advanced-use/testing): node elements report a
// fixed size so React Flow considers them measured and renders edges.
function mockReactFlow() {
  // React Flow measures nodes through ResizeObserver callbacks; the no-op stub above never calls
  // back, so nodes would stay unmeasured and edges would never render. Report the observed
  // element once on observe() (as in the React Flow guide) — harmless for Radix, which only reads
  // sizes when entries carry them.
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const el = target as HTMLElement;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const entry = {
        target,
        contentRect: { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height },
      } as unknown as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  };
  if (!globalThis.DOMMatrixReadOnly) {
    class DOMMatrixReadOnlyStub {
      m22: number;
      constructor(transform?: string) {
        const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
        this.m22 = scale !== undefined ? +scale : 1;
      }
    }
    // @ts-expect-error -- minimal stub, only m22 is read by React Flow
    globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
  }
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("react-flow__node") ? 40 : 0;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("react-flow__node") ? 100 : 0;
      },
    },
  });
  if (!("getBBox" in SVGElement.prototype)) {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    });
  }
}
mockReactFlow();
