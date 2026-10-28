import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A `matchMedia` stub whose single media query list can be flipped with `setMatches`. */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => mediaQueryList);
  return {
    listeners,
    setMatches(matches: boolean) {
      mediaQueryList.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("useMediaQuery", () => {
  it("follows the media query as the window crosses it", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 75rem)"));
    expect(result.current).toBe(false);

    act(() => media.setMatches(true));
    expect(result.current).toBe(true);
  });

  it("stops listening on unmount", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 75rem)"));

    unmount();

    expect(media.listeners.size).toBe(0);
  });
});
