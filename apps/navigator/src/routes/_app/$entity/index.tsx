import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
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
import { preloadEntityItemCollection } from "@contentgrid/views/entity-item-collection";
import type { CollectionViewState } from "@contentgrid/views/entity-item-collection";
import {
  EntityItemSplitView,
  type EntityItemSplitViewState,
  preloadEntityItemSplit,
} from "@contentgrid/views/entity-item-split";

/** The search param that holds the previewed item's id. Not an `s.*` filter, not `sort`. */
const ITEM_PARAM = "item";

/**
 * The previewed item's id from the URL. The router parses a hand-written `?item=42` into the
 * number 42 (our own links quote the string, so it round-trips), and `entitySearchStateValidator`
 * does not strip it from the merged search, so numbers are read back as their digits. Hand-written
 * ids that do not survive a number round-trip (`1e3`, `42.0`, anything above 2^53, leading zeros)
 * are not supported; ContentGrid ids are UUIDs, which stay strings.
 */
function itemFromSearch(search: Record<string, unknown>): string | undefined {
  const value = search[ITEM_PARAM];
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  // The loader re-runs when the previewed item changes, so a selection preloads its preview.
  loaderDeps: ({ search }) => ({ item: itemFromSearch(search) }),
  // The list's profile is a cache hit behind the profile gate (the `$entity` parent route's
  // `beforeLoad` loads the same one); kept so the route follows the view-data-loading contract.
  // With an `item`, the split's preload also fills the cache with that item for the preview pane.
  loader: ({ context, params, deps, cause }) => {
    const preload =
      deps.item === undefined
        ? preloadEntityItemCollection(context, params.entity)
        : preloadEntityItemSplit(context, params.entity, deps.item);
    // On "stay" (this match re-runs because the user selected or closed an item) the view is
    // already mounted and shows its own loading state, and the selection is mirrored locally, so
    // the navigation must not wait for the preview's fetch before it commits the URL. The preload
    // still fills the cache. Entering the route (a deep link, a link from elsewhere) and hover
    // preloads return it, so a deep link loads the item and the list together. Both preload
    // functions resolve and never reject, so dropping the promise leaves nothing unhandled; the
    // catch is a safety net.
    if (cause === "stay") {
      preload.catch(() => {});
      return;
    }
    return preload;
  },
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
 * The list page is the split view: the list next to a read-only preview of the selected item. The
 * app owns the address, the view owns the panes. Filters and sort live in the URL as readable,
 * shareable params, and so does the previewed item (`item=<id>`, each selection pushes a history
 * entry, so Back returns to the previous selection); the page position stays out of it (an opaque
 * cursor only resolves in the session that received it), and so does the preview pane's own state.
 * Filters, sort and page are remembered per entity in the QueryClient, so coming back to the list
 * with a clean URL — an item's breadcrumb opens it with an empty search — restores them as the
 * user left them. The selection is never remembered: a clean URL shows no preview.
 */
function EntityItemCollectionRoute({ entityName }: Readonly<{ entityName: string }>) {
  const go = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false });
  const urlFilters = useMemo(() => decodeFiltersFromSearchState(search), [search]);
  const urlSort = useMemo(() => decodeSortFromSearchState(search), [search]);
  const urlItem = itemFromSearch(search);

  // The split view's state, mirrored here and updated synchronously by `handleStateChange`, so the
  // controlled view never waits on the router's asynchronous navigation.
  const [state, setState] = useState<EntityItemSplitViewState>(() => {
    const urlIsClean = Object.keys(urlFilters).length === 0 && urlSort === undefined;
    return {
      collection: {
        filters: urlIsClean ? (recallCollectionFilters(queryClient, entityName) ?? {}) : urlFilters,
        sort: urlIsClean ? recallCollectionSort(queryClient, entityName) : urlSort,
        // The remembered page belongs to the remembered filters/sort — a URL that carries either
        // of its own is a different search, so it starts at page 1 rather than reusing a stale link.
        pageUrl: urlIsClean ? recallCollectionPageHref(queryClient, entityName) : undefined,
      },
      selectedItemId: urlItem,
    };
  });
  const collection = state.collection ?? EMPTY_COLLECTION;

  // Remembers whatever the list shows, however it got there (the URL, the memo, or a change in
  // the view), so a round trip through a clean-URL page restores it.
  useEffect(() => {
    rememberCollectionFilters(queryClient, entityName, collection.filters ?? {});
    rememberCollectionSort(queryClient, entityName, collection.sort);
    rememberCollectionPageHref(queryClient, entityName, collection.pageUrl);
  }, [collection, queryClient, entityName]);

  // Once, on mount: when the state was restored from the memo, write it back into the URL so the
  // address bar agrees with the list and is shareable again. Replaces, so back skips the clean URL.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;
    if (Object.keys(urlFilters).length > 0 || urlSort !== undefined) return;
    if (Object.keys(collection.filters ?? {}).length === 0 && collection.sort === undefined) return;
    void go({
      to: "/$entity",
      params: { entity: entityName },
      search: (prev) =>
        applySortToSearchState(
          applyFiltersToSearchState(prev, collection.filters ?? {}),
          collection.sort,
        ),
      replace: true,
    });
  }, [urlFilters, urlSort, collection, go, entityName]);

  // After mount the URL is authoritative: back/forward between two searches or items, or a link
  // opened while already here, shows that search from its first page and that item. It re-syncs
  // on every committed router load, by value, not only when the URL values change identity: a
  // navigation superseded before it commits (Back during a pending load) leaves the URL where it
  // was while the mirrored state moved on, and no URL value changes to tell us. It waits for the
  // router to be idle so a still-pending navigation of ours is not undone by an earlier commit.
  const loadedAt = useRouterState({ select: (s) => s.loadedAt });
  const routerIdle = useRouterState({ select: (s) => s.status === "idle" });
  const lastSyncRef = useRef({ urlFilters, urlSort, urlItem, loadedAt });
  useEffect(() => {
    if (!routerIdle) return;
    const last = lastSyncRef.current;
    if (
      last.urlFilters === urlFilters &&
      last.urlSort === urlSort &&
      last.urlItem === urlItem &&
      last.loadedAt === loadedAt
    ) {
      return;
    }
    lastSyncRef.current = { urlFilters, urlSort, urlItem, loadedAt };
    setState((current) => {
      const searchInSync = sameSearch(current.collection, urlFilters, urlSort);
      const itemInSync = current.selectedItemId === urlItem;
      if (searchInSync && itemInSync) return current;
      return {
        // The page only resets when the search itself differs.
        collection: searchInSync
          ? current.collection
          : { filters: urlFilters, sort: urlSort, pageUrl: undefined },
        selectedItemId: urlItem,
      };
    });
  }, [urlFilters, urlSort, urlItem, loadedAt, routerIdle]);

  function handleStateChange(next: EntityItemSplitViewState) {
    setState(next);
    const searchChanged = !sameSearch(
      state.collection,
      next.collection?.filters ?? {},
      next.collection?.sort,
    );
    const itemChanged = state.selectedItemId !== next.selectedItemId;
    if (!searchChanged && !itemChanged) return;
    // One navigation, whatever changed; it pushes, so Back undoes it.
    void go({
      to: "/$entity",
      params: { entity: entityName },
      search: (prev) => {
        const withSearch = searchChanged
          ? applySortToSearchState(
              applyFiltersToSearchState(prev, next.collection?.filters ?? {}),
              next.collection?.sort,
            )
          : prev;
        return itemChanged ? applyItemToSearchState(withSearch, next.selectedItemId) : withSearch;
      },
    });
  }

  return (
    <EntityItemSplitView entityName={entityName} state={state} onStateChange={handleStateChange} />
  );
}

const EMPTY_COLLECTION: CollectionViewState = {};

/** Sets or removes the `item` param, leaving every other key untouched. */
function applyItemToSearchState(
  prev: Record<string, string | undefined>,
  itemId: string | undefined,
): Record<string, string | undefined> {
  const rest = Object.fromEntries(Object.entries(prev).filter(([key]) => key !== ITEM_PARAM));
  return itemId === undefined ? rest : { ...rest, [ITEM_PARAM]: itemId };
}

function sameSearch(
  state: CollectionViewState | undefined,
  filters: Record<string, string>,
  sort: string | undefined,
): boolean {
  const current = state?.filters ?? {};
  const keys = Object.keys(current);
  return (
    state?.sort === sort &&
    keys.length === Object.keys(filters).length &&
    keys.every((key) => current[key] === filters[key])
  );
}
