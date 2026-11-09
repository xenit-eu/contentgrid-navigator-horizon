import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  applyFiltersToSearchState,
  applySortToSearchState,
  decodeFiltersFromSearchState,
  decodeSortFromSearchState,
  entitySearchStateValidator,
} from "@contentgrid/features/search";
import {
  recallCollectionFilters,
  recallCollectionPageHref,
  recallCollectionSort,
  rememberCollectionFilters,
  rememberCollectionPageHref,
  rememberCollectionSort,
} from "@contentgrid/navigator-data";
import {
  type CollectionViewState,
  EntityItemCollectionView,
} from "@contentgrid/views/entity-item-collection";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  component: EntityItemCollectionPage,
});

function EntityItemCollectionPage() {
  const { entity: entityName } = useParams({ strict: false });
  if (!entityName) return <LoadingPage />;

  // Remounts on an entity switch, so the state seeded from one entity's memo never leaks into
  // another's list.
  return <EntityItemCollectionRoute key={entityName} entityName={entityName} />;
}

/**
 * The list page: the app owns the address, the view owns the list. Filters and sort live in the
 * URL as readable, shareable params; the page position stays out of it (an opaque cursor only
 * resolves in the session that received it). All three are remembered per entity in the
 * QueryClient, so coming back to the list with a clean URL — an item's breadcrumb opens it with an
 * empty search — restores it as the user left it.
 */
function EntityItemCollectionRoute({ entityName }: Readonly<{ entityName: string }>) {
  const go = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false });
  const urlFilters = useMemo(() => decodeFiltersFromSearchState(search), [search]);
  const urlSort = useMemo(() => decodeSortFromSearchState(search), [search]);

  const [state, setState] = useState<CollectionViewState>(() => {
    const urlIsClean = Object.keys(urlFilters).length === 0 && urlSort === undefined;
    return {
      filters: urlIsClean ? (recallCollectionFilters(queryClient, entityName) ?? {}) : urlFilters,
      sort: urlIsClean ? recallCollectionSort(queryClient, entityName) : urlSort,
      // The remembered page belongs to the remembered filters/sort — a URL that carries either
      // of its own is a different search, so it starts at page 1 rather than reusing a stale link.
      pageUrl: urlIsClean ? recallCollectionPageHref(queryClient, entityName) : undefined,
    };
  });

  // Remembers whatever the list shows, however it got there (the URL, the memo, or a change in
  // the view), so a round trip through a clean-URL page restores it.
  useEffect(() => {
    rememberCollectionFilters(queryClient, entityName, state.filters ?? {});
    rememberCollectionSort(queryClient, entityName, state.sort);
    rememberCollectionPageHref(queryClient, entityName, state.pageUrl);
  }, [state, queryClient, entityName]);

  // Once, on mount: when the state was restored from the memo, write it back into the URL so the
  // address bar agrees with the list and is shareable again. Replaces, so back skips the clean URL.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    if (Object.keys(urlFilters).length > 0 || urlSort !== undefined) return;
    if (Object.keys(state.filters ?? {}).length === 0 && state.sort === undefined) return;
    void go({
      to: "/$entity",
      params: { entity: entityName },
      search: (prev) =>
        applySortToSearchState(applyFiltersToSearchState(prev, state.filters ?? {}), state.sort),
      replace: true,
    });
  }, [urlFilters, urlSort, state, go, entityName]);

  // After mount the URL is authoritative: back/forward between two searches, or a link opened
  // while already here, shows that search from its first page.
  const lastUrlSearchRef = useRef({ urlFilters, urlSort });
  useEffect(() => {
    const last = lastUrlSearchRef.current;
    if (last.urlFilters === urlFilters && last.urlSort === urlSort) return;
    lastUrlSearchRef.current = { urlFilters, urlSort };
    setState((current) =>
      sameSearch(current, urlFilters, urlSort)
        ? current
        : { filters: urlFilters, sort: urlSort, pageUrl: undefined },
    );
  }, [urlFilters, urlSort]);

  function handleStateChange(next: CollectionViewState) {
    setState(next);
    if (sameSearch(state, next.filters ?? {}, next.sort)) return;
    void go({
      to: "/$entity",
      params: { entity: entityName },
      search: (prev) =>
        applySortToSearchState(applyFiltersToSearchState(prev, next.filters ?? {}), next.sort),
    });
  }

  return (
    <EntityItemCollectionView
      entityName={entityName}
      state={state}
      onStateChange={handleStateChange}
    />
  );
}

function sameSearch(
  state: CollectionViewState,
  filters: Record<string, string>,
  sort: string | undefined,
): boolean {
  const current = state.filters ?? {};
  const keys = Object.keys(current);
  return (
    state.sort === sort &&
    keys.length === Object.keys(filters).length &&
    keys.every((key) => current[key] === filters[key])
  );
}
