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
