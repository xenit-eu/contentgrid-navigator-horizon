import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// jsdom does not implement ResizeObserver, which Radix UI's Popper (used by
// Tooltip / Popover / DropdownMenu / Select) relies on for positioning. Without
// this polyfill the Popper occasionally throws during layout, causing flaky
// failures in tooltip-wrapped interaction tests. Provide a no-op implementation.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom also lacks these element methods that Radix occasionally calls.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}

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
