import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemCollectionView } from "@contentgrid/features/entity-item-collection";
import {
  type ProfileEntity,
  entitySearchStateValidator,
  extractCursorFromHref,
  registerCursorHref,
  resolveCursorHref,
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

  return <EntityItemCollectionRoute profile={profile} />;
}

function EntityItemCollectionRoute({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const go = useNavigate();
  const queryClient = useQueryClient();
  const { cursor } = useSearch({ strict: false });

  // The URL's opaque cursor is resolved back to the concrete page href it was
  // registered with (never rebuilt from parts). Absent/unknown cursor → first
  // page.
  const pageUrl = cursor ? resolveCursorHref(queryClient, profile.name, cursor) : undefined;

  // Cursor navigation never builds a URL: remember the href a cursor came from
  // in the registry, then carry the opaque cursor in the URL's search state.
  function onPageChange(href: string | undefined) {
    const nextCursor = extractCursorFromHref(href);
    if (nextCursor && href) registerCursorHref(queryClient, profile.name, nextCursor, href);
    go({
      to: "/$entity",
      params: { entity: profile.name },
      search: (prev) => ({ ...prev, cursor: nextCursor }),
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
    <EntityItemCollectionView
      profile={profile}
      pageUrl={pageUrl}
      actions={actions}
      toolbar
      breadcrumbs={breadcrumbs}
      onEntityItemClick={(itemId) =>
        go({
          to: "/$entity/$itemId",
          params: { entity: profile.name, itemId },
          search: (prev) => prev,
        })
      }
      onPageChange={onPageChange}
    />
  );
}
