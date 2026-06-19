import { Link, Outlet, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  AttributeKind,
  type EntityItem,
  type ProfileEntity,
  createValues,
  useCreateEntityItem,
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
  Skeleton,
} from "@contentgrid/ui";
import { ProfileAttributeType } from "../../../navigator-data/src/accessors/attribute-profile";

// ---------------------------------------------------------------------------
// Search param validator — export for use in the $entity route's validateSearch
// ---------------------------------------------------------------------------

export function entityDetailSearchValidator(search: Record<string, unknown>): { q?: string } {
  return { q: typeof search.q === "string" ? search.q : undefined };
}

// ---------------------------------------------------------------------------
// Cross-package navigate cast
// useNavigate() is typed against the app's registered router, which the feature
// package doesn't see at compile time. The cast bridges that boundary.
// ---------------------------------------------------------------------------

type AnyNavigateFn = (opts: {
  to?: string;
  params?: Record<string, string>;
  search?: ((prev: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>;
}) => void;

// ---------------------------------------------------------------------------
// EntityListLayout — pathless layout route component (sidebar + BrandingHeader + Outlet)
// ---------------------------------------------------------------------------

export function EntityListLayout() {
  const { entity: activeEntity } = useParams({ strict: false }) as { entity?: string };

  const profileResults = useProfileEntities();
  const isLoadingProfiles = profileResults.length > 0 && profileResults.every((r) => r.isPending);
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const selectedProfile = activeEntity
    ? loadedProfiles.find((p) => p.name === activeEntity)
    : undefined;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Entities</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoadingProfiles
                  ? [1, 2, 3].map((i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuSkeleton />
                      </SidebarMenuItem>
                    ))
                  : loadedProfiles.map((profile) => (
                      <SidebarMenuItem key={profile.name}>
                        <SidebarMenuButton asChild isActive={activeEntity === profile.name}>
                          <Link
                            to={"/$entity" as string}
                            params={{ entity: profile.name } as Record<string, string>}
                          >
                            {profile.pluralName}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <BrandingHeader
          title="ContentGrid Navigator"
          subtitle={selectedProfile?.pluralName ?? "Entity browser"}
          actions={<SidebarTrigger />}
        />
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ---------------------------------------------------------------------------
// EntityOverviewPage — index route component (grid of entity cards)
// ---------------------------------------------------------------------------

export function EntityOverviewPage() {
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;

  return (
    <EntityOverview
      onSelectEntity={(profile) => go({ to: "/$entity", params: { entity: profile.name } })}
    />
  );
}

// ---------------------------------------------------------------------------
// EntityDetailPage — $entity route component (reads path + q search param)
// ---------------------------------------------------------------------------

export function EntityDetailPage() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const { q } = useSearch({ strict: false }) as { q?: string };
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;

  const profileResults = useProfileEntities();
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const isLoadingProfiles = profileResults.length > 0 && profileResults.every((r) => r.isPending);

  const profile = loadedProfiles.find((p) => p.name === entityName);

  function onCursorChange(url: string | undefined) {
    if (url) {
      go({ search: (prev) => ({ ...prev, q: url }) });
    } else {
      go({
        search: (prev) => {
          const next = { ...prev };
          delete next["q"];
          return next;
        },
      });
    }
  }

  function onBack() {
    go({ to: "/", search: {} });
  }

  if (isLoadingProfiles || (!profile && profileResults.length > 0)) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-md" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <EntityDetailView
      profile={profile}
      pageUrl={q}
      onPageUrlChange={onCursorChange}
      onBack={onBack}
    />
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
  const collection = useEntityItemCollection(
    { profileEntity: profile },
    { queryOptionsOverride: { refetchOnWindowFocus: false, refetchOnMount: false } },
  );

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
  pageUrl,
  onPageUrlChange,
  onBack,
}: Readonly<{
  profile: ProfileEntity;
  pageUrl: string | undefined;
  onPageUrlChange: (url: string | undefined) => void;
  onBack: () => void;
}>) {
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
          <CreateEntityButton profile={profile} />
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
                  onPageUrlChange(collection.data.prevHref);
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
                  onPageUrlChange(collection.data.nextHref);
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
// CreateEntityButton — submits default (empty) values as a placeholder example
// ---------------------------------------------------------------------------

function CreateEntityButton({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const { mutate, isPending, error } = useCreateEntityItem(profile);
  const createTemplate = profile.createTemplate;

  if (!createTemplate) return null;

  function handleCreate() {
    // NOTE: sending default (empty) values — a real implementation would
    // collect user input via a form before calling mutate.
    mutate(createValues(createTemplate!.template));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={isPending} onClick={handleCreate}>
        {isPending ? "Creating…" : "Create"}
      </Button>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
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
          data[attr.value.name] = attr.value.metadata?.filename ?? "-";
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
