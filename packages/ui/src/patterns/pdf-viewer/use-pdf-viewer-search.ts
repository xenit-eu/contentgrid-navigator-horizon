import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchFlag } from "@embedpdf/models";
import type { ScrollScope } from "@embedpdf/plugin-scroll/react";
import { useSearch } from "@embedpdf/plugin-search/react";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * `activeIndex` is 0-based (matches the plugin's `activeResultIndex`) and is
 * `-1` when there is no active match (no query, or no results yet).
 */
export interface PdfViewerSearchState {
  readonly query: string;
  readonly total: number;
  readonly activeIndex: number;
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
  /** Whether the search popover is open — local UI state, not plugin state. */
  readonly open: boolean;
}

export interface PdfViewerSearchActions {
  setQuery: (query: string) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  toggleMatchCase: () => void;
  toggleWholeWord: () => void;
  clearSearch: () => void;
  setOpen: (open: boolean) => void;
}

/** The `search` state with no document open (or no search performed yet): every control reads as inert. */
export const ZERO_SEARCH: PdfViewerSearchState = {
  query: "",
  total: 0,
  activeIndex: -1,
  matchCase: false,
  wholeWord: false,
  open: false,
};
export const NOOP_SEARCH_ACTIONS: PdfViewerSearchActions = {
  setQuery: () => {},
  nextMatch: () => {},
  previousMatch: () => {},
  toggleMatchCase: () => {},
  toggleWholeWord: () => {},
  clearSearch: () => {},
  setOpen: () => {},
};

export interface UseDocumentSearchStateOptions {
  readonly documentId: string;
  /**
   * The scroll plugin's per-document scope (`useScroll(documentId).provides`
   * from `@embedpdf/plugin-scroll/react`), passed in rather than obtained via
   * a second `useScroll` call here — `usePdfViewerActiveState` already holds
   * one for page navigation, and only one is needed to scroll the active
   * match into view.
   */
  readonly scroll: ScrollScope | null;
}

export interface DocumentSearchState {
  readonly search: PdfViewerSearchState;
  readonly searchActions: PdfViewerSearchActions;
}

/**
 * Search state/actions for one already-open document (T035), split out of
 * `use-pdf-viewer-state.ts` as its own file: unlike the page/zoom/fullscreen
 * concerns there, search has a clean input (`documentId` + the scroll scope)
 * and output (`search`/`searchActions`) boundary, with no other slice
 * depending on its internals.
 *
 * `useSearch` (unlike `useScroll`/`useZoom`) never throws for a document id
 * whose plugin-scoped state isn't initialized yet — it falls back to an
 * empty result instead (verified against the compiled
 * `@embedpdf/plugin-search` `/react` source) — so this hook needs no extra
 * gating beyond the caller's existing "only mounted once `documentId` is
 * real" rule.
 */
export function useDocumentSearchState({
  documentId,
  scroll,
}: UseDocumentSearchStateOptions): DocumentSearchState {
  const { provides: search, state: searchState } = useSearch(documentId);
  const [searchOpen, setSearchOpen] = useState(false);

  // `matchCase`/`wholeWord` are derived from the plugin's `flags` array
  // (there is no dedicated boolean field for either on the plugin's own
  // `SearchDocumentState`). `open` is local UI state: the plugin has no
  // concept of a popover, only of an "active" search session, which we start
  // implicitly on the first non-empty query and stop explicitly when the
  // popover closes (also the "clear" action — `stopSearch()` resets `query`,
  // `results`, `total` and `activeResultIndex` to their initial values in one
  // call, verified against the compiled reducer).
  const matchCase = searchState.flags.includes(MatchFlag.MatchCase);
  const wholeWord = searchState.flags.includes(MatchFlag.MatchWholeWord);

  const searchView: PdfViewerSearchState = useMemo(
    () => ({
      query: searchState.query,
      total: searchState.total,
      activeIndex: searchState.activeResultIndex,
      matchCase,
      wholeWord,
      open: searchOpen,
    }),
    [
      searchState.query,
      searchState.total,
      searchState.activeResultIndex,
      matchCase,
      wholeWord,
      searchOpen,
    ],
  );

  // Scroll the active match into view (FR-014). Neither the plugin nor any
  // installed `@embedpdf/*` package does this on its own: `nextResult`/
  // `previousResult`/a fresh search only dispatch `setActiveResultIndex` and
  // notify `onActiveResultChange` (confirmed by reading the compiled
  // `@embedpdf/plugin-search` source and grepping every installed
  // `@embedpdf/*` package for a consumer of that event — there is none).
  // `SearchResult.pageIndex` is 0-based; `SearchResult.rects[0].origin` is in
  // the *same* page-local, unscaled coordinate space `ScrollToPageOptions.pageCoordinates`
  // expects (confirmed from `@embedpdf/plugin-scroll`'s compiled
  // `getScrollPositionForPage`, which passes `pageCoordinates` straight into
  // its own page-to-viewport transform alongside the page's own scale/rotation
  // — the same values `SearchLayer` uses directly, pre-scale, to draw its
  // highlight rects). Centered (`alignX`/`alignY: 50`) so the match doesn't
  // land flush against a viewport edge.
  //
  // Deduplicated by the active result's own identity (`pageIndex:charIndex`),
  // not by "is it already on the current page": a page can hold more than one
  // match, and being on the right page doesn't mean the specific rect is
  // still within the viewport (the user may have scrolled since) — always
  // re-centering on the active match is what FR-014 ("scrolled into view")
  // actually requires, so this never skips a genuine match change.
  const activeResultKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scroll) return;
    const activeResult = searchState.results[searchState.activeResultIndex];
    if (!activeResult) {
      activeResultKeyRef.current = null;
      return;
    }
    const key = `${activeResult.pageIndex}:${activeResult.charIndex}`;
    if (activeResultKeyRef.current === key) return;
    activeResultKeyRef.current = key;
    const rect = activeResult.rects[0];
    scroll.scrollToPage({
      pageNumber: activeResult.pageIndex + 1,
      pageCoordinates: rect ? { x: rect.origin.x, y: rect.origin.y } : undefined,
      behavior: "smooth",
      alignX: 50,
      alignY: 50,
    });
  }, [scroll, searchState.results, searchState.activeResultIndex]);

  // `searchAllPages` is idempotent for an unchanged, already-searched query
  // (the plugin resolves immediately from cached results without
  // re-searching) — safe to call on every keystroke, including the initial
  // empty string, which the plugin treats as "clear" (dispatches empty
  // results rather than rejecting).
  const setQuery = useCallback((query: string) => search?.searchAllPages(query), [search]);
  const nextMatch = useCallback(() => search?.nextResult(), [search]);
  const previousMatch = useCallback(() => search?.previousResult(), [search]);
  const toggleMatchCase = useCallback(() => {
    const flags = matchCase
      ? searchState.flags.filter((flag) => flag !== MatchFlag.MatchCase)
      : [...searchState.flags, MatchFlag.MatchCase];
    search?.setFlags(flags);
  }, [search, matchCase, searchState.flags]);
  const toggleWholeWord = useCallback(() => {
    const flags = wholeWord
      ? searchState.flags.filter((flag) => flag !== MatchFlag.MatchWholeWord)
      : [...searchState.flags, MatchFlag.MatchWholeWord];
    search?.setFlags(flags);
  }, [search, wholeWord, searchState.flags]);
  const clearSearch = useCallback(() => search?.stopSearch(), [search]);
  const setSearchOpenAction = useCallback(
    (open: boolean) => {
      setSearchOpen(open);
      if (!open) search?.stopSearch();
    },
    [search],
  );

  return {
    search: searchView,
    searchActions: {
      setQuery,
      nextMatch,
      previousMatch,
      toggleMatchCase,
      toggleWholeWord,
      clearSearch,
      setOpen: setSearchOpenAction,
    },
  };
}
