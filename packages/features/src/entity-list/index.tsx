import { useState } from "react";
import {
  AttributeKind,
  type EntityItem,
  type ProfileEntity,
  useEntityItemCollection,
  useProfileEntities,
} from "@contentgrid/navigator-data";
import {
  Badge,
  BrandingHeader,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  EntityCard,
  Separator,
  Skeleton,
} from "@contentgrid/ui";
import { ProfileAttributeType } from "../../../navigator-data/src/accessors/attribute-profile";

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

type ViewState = { view: "overview" } | { view: "entity"; profile: ProfileEntity };

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function EntityList() {
  const [viewState, setViewState] = useState<ViewState>({ view: "overview" });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BrandingHeader
        title="ContentGrid Navigator"
        subtitle={viewState.view === "entity" ? viewState.profile.pluralName : "Entity browser"}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {viewState.view === "entity" ? (
          <EntityDetailView
            profile={viewState.profile}
            onBack={() => setViewState({ view: "overview" })}
          />
        ) : (
          <EntityOverview onSelectEntity={(profile) => setViewState({ view: "entity", profile })} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview — grid of EntityCard components
// ---------------------------------------------------------------------------

function EntityOverview({
  onSelectEntity,
}: Readonly<{ onSelectEntity: (profile: ProfileEntity) => void }>) {
  const profileResults = useProfileEntities();

  const isLoading = profileResults.length > 0 && profileResults.every((r) => r.isPending);
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <OverviewHeader count={0} loading />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (loadedProfiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">No entities found</p>
        <p className="text-sm">Make sure your ContentGrid application has entities defined.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OverviewHeader count={loadedProfiles.length} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadedProfiles.map((profile) => (
          <EntityCardConnected
            key={profile.name}
            profile={profile}
            onSelect={() => onSelectEntity(profile)}
          />
        ))}
      </div>
    </div>
  );
}

function OverviewHeader({
  count,
  loading = false,
}: Readonly<{ count: number; loading?: boolean }>) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Loading…" : `${count} entity type${count !== 1 ? "s" : ""} available`}
        </p>
      </div>
    </div>
  );
}

// EntityCard wired to the live collection count
function EntityCardConnected({
  profile,
  onSelect,
}: Readonly<{ profile: ProfileEntity; onSelect: () => void }>) {
  const collection = useEntityItemCollection({ profileEntity: profile });

  return (
    <EntityCard
      name={profile.name}
      title={profile.pluralName}
      description={profile.description || undefined}
      count={collection.data?.totalItems?.count}
      hasContent={profile.attributes.some((a) => a.type === ProfileAttributeType.object)}
      onTitleClick={onSelect}
      onCreateClick={onSelect}
    />
  );
}

// ---------------------------------------------------------------------------
// Detail view — breadcrumb + DataTable + pagination
// ---------------------------------------------------------------------------

function EntityDetailView({
  profile,
  onBack,
}: Readonly<{ profile: ProfileEntity; onBack: () => void }>) {
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);

  const collection = useEntityItemCollection(
    pageUrl ? { url: pageUrl, profileEntity: profile } : { profileEntity: profile },
  );

  const columns = buildColumns(profile);
  const rows = collection.data ? buildRows(collection.data.items, columns) : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              All entities
            </button>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.pluralName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Separator />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.pluralName}</h1>
          {profile.description && (
            <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {collection.isSuccess && collection.data.totalItems && (
            <Badge variant="secondary">
              {collection.data.totalItems.count.toLocaleString()} item
              {collection.data.totalItems.count !== 1 ? "s" : ""}
              {collection.data.totalItems.isEstimated && " (est.)"}
            </Badge>
          )}
          {collection.isPending && <Skeleton className="h-6 w-20 rounded-full" />}
        </div>
      </div>

      {/* Table skeleton */}
      {collection.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Error */}
      {collection.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load {profile.pluralName}: {collection.error.message}
        </div>
      )}

      {/* Table */}
      {collection.isSuccess && (
        <div className="space-y-4">
          <DataTable
            entityName={profile.name}
            entityTitle={profile.pluralName}
            columns={columns}
            rows={rows}
          />

          {/* Pagination */}
          {(collection.data.hasNext || collection.data.hasPrevious) && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!collection.data.hasPrevious}
                onClick={() => {
                  setPageUrl(collection.data.prevHref);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {collection.data.pageSize} items on this page
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!collection.data.hasNext}
                onClick={() => {
                  setPageUrl(collection.data.nextHref);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_COLUMNS = 5;

function buildColumns(profile: ProfileEntity): DataTableColumn[] {
  const userAttrs = profile.userDefinedAttributes.slice(0, MAX_COLUMNS);

  if (userAttrs.length === 0) {
    return [{ key: "id", header: "ID" }];
  }

  return userAttrs.map((attr) => ({
    key: attr.name,
    header: attr.title ?? attr.name,
  }));
}

function buildRows(items: readonly EntityItem[], columns: DataTableColumn[]): DataTableRow[] {
  const columnKeys = new Set(columns.map((c) => c.key));

  return items.map((item) => {
    const data: Record<string, unknown> = {};

    if (columnKeys.has("id")) {
      data["id"] = item.halItem.data.id;
    }

    for (const attr of item.userDefinedAttributes) {
      if (!columnKeys.has(attr.value.name)) continue;

      switch (attr.value.kind) {
        case AttributeKind.PLAIN:
          data[attr.value.name] = attr.value.value;
          break;
        case AttributeKind.CONTENT:
          data[attr.value.name] = attr.value.metadata?.filename ?? "(file)";
          break;
        case AttributeKind.NESTED:
          data[attr.value.name] = "(object)";
          break;
        default:
          data[attr.value.name] = null;
      }
    }

    return { id: String(item.halItem.data.id), data };
  });
}
