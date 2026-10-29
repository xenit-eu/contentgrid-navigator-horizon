import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Matches the `--breakpoint-split` token in preset.css, the width the `split:` classes start at. */
export const SPLIT_BREAKPOINT_QUERY = "(min-width: 75rem)";

/** Whether the window matches the CSS media `query`; updates as the window resizes. */
export function useMediaQuery(query: string): boolean {
  const mediaQuery = useMemo(() => window.matchMedia(query), [query]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [mediaQuery],
  );

  return useSyncExternalStore(subscribe, () => mediaQuery.matches);
}
