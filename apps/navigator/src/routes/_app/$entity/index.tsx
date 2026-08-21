import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemCollectionSearchView } from "@contentgrid/features/entity-item-collection";
import {
  applyFiltersToSearchState,
  decodeFiltersFromSearchState,
} from "@contentgrid/features/search";
import {
  type ProfileEntity,
  entitySearchStateValidator,
  recallCollectionPageHref,
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
  const filters = useMemo(() => decodeFiltersFromSearchState(search), [search]);

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

  // Filters round-trip through the URL as individual, readable s.<property> params — shareable
  // across sessions, unlike pagination position.
  function handleFiltersChange(nextFilters: Record<string, string>) {
    handlePageChange(undefined);
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
        go({
          to: "/$entity/$itemId",
          params: { entity: profile.name, itemId },
          search: (prev) => prev,
        })
      }
    />
  );
}
