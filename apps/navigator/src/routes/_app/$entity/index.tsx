import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemCollectionSearchView } from "@contentgrid/features/entity-item-collection";
import {
  applyFiltersToSearchState,
  decodeFiltersFromSearchState,
  entitySearchStateValidator,
} from "@contentgrid/features/search";
import {
  type ProfileEntity,
  recallCollectionFilters,
  recallCollectionPageHref,
  rememberCollectionFilters,
  rememberCollectionPageHref,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@contentgrid/ui";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  component: EntityItemCollectionPage,
});

function EntityItemCollectionPage() {
  const { entity: entityName } = useParams({ strict: false });

  // EntityProfileGate (the parent /$entity route) already resolved and
  // validated the profile before this renders — this is a cached read.
  const { data: profile } = useProfileEntity({ name: entityName });

  if (!profile) return <LoadingPage />;

  // Remounts EntityItemCollectionRoute on a genuine entity switch, so its pageUrl state (seeded
  // once from the page-href memo on mount) doesn't leak the previous entity's remembered page.
  return <EntityItemCollectionRoute key={profile.name} profile={profile} />;
}

function EntityItemCollectionRoute({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const go = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false });
  const urlFilters = useMemo(() => decodeFiltersFromSearchState(search), [search]);

  // Filters round-trip through the URL as individual, readable s.<property> params — shareable
  // across sessions — EXCEPT across a trip to an item's detail page: that page's URL stays
  // clean (see `onEntityItemClick` below and the $itemId route's breadcrumb), so the URL alone
  // isn't enough to restore them on the way back. `rememberCollectionFilters` is a second, plain
  // memo written on every real change (below) — independent of pagination, unlike the page-href
  // memo, which only ever gets written on an explicit next/prev click and is therefore empty
  // for a filter the user applied but never paged through.
  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.keys(urlFilters).length > 0
      ? urlFilters
      : (recallCollectionFilters(queryClient, profile.name) ?? {}),
  );

  // Keeps `filters` in sync if the URL's own filters change while this route stays mounted
  // (e.g. browser back/forward between two filtered searches, or a shared link opened while
  // already here). Never resets to `{}` on its own — an empty URL is ambiguous between "not
  // synced from the URL yet" and "explicitly cleared," and the explicit-clear path
  // (`handleFiltersChange`) already updates `filters` directly for that case.
  useEffect(() => {
    if (Object.keys(urlFilters).length > 0) setFilters(urlFilters);
  }, [urlFilters]);

  // Pagination position is deliberately kept out of the URL — an opaque cursor only ever
  // resolves back to a real page in the session that received it from the server, so there's
  // nothing to gain from putting it there. It's remembered per entity in the QueryClient cache
  // instead, purely to survive an unmount/remount within this session (e.g. item detail → back).
  const [pageUrl, setPageUrl] = useState<string | undefined>(() =>
    recallCollectionPageHref(queryClient, profile.name),
  );

  function handlePageChange(href: string | undefined) {
    setPageUrl(href);
    rememberCollectionPageHref(queryClient, profile.name, href);
  }

  function handleFiltersChange(nextFilters: Record<string, string>) {
    handlePageChange(undefined);
    setFilters(nextFilters);
    rememberCollectionFilters(queryClient, profile.name, nextFilters);
    go({
      to: "/$entity",
      params: { entity: profile.name },
      search: (prev) => applyFiltersToSearchState(prev, nextFilters),
    });
  }

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() => go({ to: "/", search: {} })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{profile.pluralName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  const actions = (
    <div>
      <Button
        variant="default"
        onClick={() => go({ to: "/$entity/~create", params: { entity: profile.name }, search: {} })}
      >
        Create {profile.singularName}
      </Button>
    </div>
  );

  return (
    <EntityItemCollectionSearchView
      profile={profile}
      pageUrl={pageUrl}
      onPageChange={handlePageChange}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      actions={actions}
      toolbar
      breadcrumbs={breadcrumbs}
      onEntityItemClick={(itemId: string) =>
        // Filters are deliberately NOT forwarded into the item-detail URL — they stay
        // recoverable via `rememberCollectionFilters`/`rememberCollectionPageHref`, so the
        // breadcrumb back to this list restores them from the QueryClient cache rather than
        // round-tripping through the URL.
        go({
          to: "/$entity/$itemId",
          params: { entity: profile.name, itemId },
          search: {},
        })
      }
    />
  );
}
