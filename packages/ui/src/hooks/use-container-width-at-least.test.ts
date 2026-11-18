import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useContainerWidthAtLeast } from "./use-container-width-at-least";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--container-side-by-side");
  document.documentElement.style.removeProperty("font-size");
});

/** A `ResizeObserver` stub; calling the returned callbacks reports a resize. */
function stubResizeObserver() {
  const callbacks = new Set<() => void>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        callbacks.add(this.callback);
      }
      disconnect() {
        callbacks.delete(this.callback);
      }
    },
  );
  return callbacks;
}

/** An element in the document, `width` px wide, inheriting `--container-side-by-side`. */
function elementOfWidth(width: number) {
  const element = document.createElement("div");
  document.body.append(element);
  Object.defineProperty(element, "clientWidth", { configurable: true, value: width });
  return element;
}

describe("useContainerWidthAtLeast", () => {
  it("follows the element's width across the CSS width", () => {
    // jsdom has no default font size in pixels, as a browser has.
    document.documentElement.style.fontSize = "16px";
    document.documentElement.style.setProperty("--container-side-by-side", "55rem");
    const callbacks = stubResizeObserver();
    const element = elementOfWidth(879);
    const { result } = renderHook(() =>
      useContainerWidthAtLeast({ current: element }, "side-by-side"),
    );
    expect(result.current).toBe(false);

    Object.defineProperty(element, "clientWidth", { value: 880 });
    act(() => callbacks.forEach((callback) => callback()));
    expect(result.current).toBe(true);
  });

  it("stops observing on unmount", () => {
    const callbacks = stubResizeObserver();
    const { unmount } = renderHook(() =>
      useContainerWidthAtLeast({ current: elementOfWidth(0) }, "side-by-side"),
    );

    unmount();

    expect(callbacks.size).toBe(0);
  });
});
