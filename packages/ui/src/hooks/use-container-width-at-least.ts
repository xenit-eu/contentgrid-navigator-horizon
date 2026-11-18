import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Whether the element in `ref` is at least as wide as the `--container-<name>` width from
 * preset.css: the same check as the `@<name>:` classes inside an `@container`. Updates as the
 * element resizes, e.g. when the window is resized or the sidebar is opened or closed.
 */
export function useContainerWidthAtLeast(ref: RefObject<Element | null>, name: string): boolean {
  const [isAtLeast, setIsAtLeast] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const minWidth = toPixels(getComputedStyle(element).getPropertyValue(`--container-${name}`));
    const update = () => setIsAtLeast(element.clientWidth >= minWidth);

    // Measured once before the first paint, so a wide view never flashes its narrow layout.
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, name]);

  return isAtLeast;
}

/** A `rem` or `px` length in pixels; `NaN` for anything else, which no width is at least. */
function toPixels(length: string): number {
  const value = length.trim();
  if (value.endsWith("rem")) {
    return parseFloat(value) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
  if (value.endsWith("px")) return parseFloat(value);
  return Number.NaN;
}
