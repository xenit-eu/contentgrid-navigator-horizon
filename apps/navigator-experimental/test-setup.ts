import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// window.matchMedia — used by next-themes (via @contentgrid/ui's Toaster) to
// detect the system color scheme.
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
