import { useCallback, useEffect, useState } from "react";
import { GearIcon } from "@phosphor-icons/react";
import { Link, Outlet, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  AttributeKind,
  type EntityItem,
  type EntityItemAttribute,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  type EntitySearchState,
  ProblemDetailError,
  type ProfileEntity,
  createValues,
  extractFieldErrors,
  resolveTrustedCollectionUrl,
  useAddToManyRelation,
  useClearRelation,
  useCreateEntityItem,
  useDeleteRelationItem,
  useEntityItem,
  useEntityItemCollection,
  useEntityItemToManyRelation,
  useEntityItemToOneRelation,
  useNavigatorData,
  useProfileEntities,
  useSetToOneRelation,
  useUnlinkRelation,
} from "@contentgrid/navigator-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EntityCard,
  Input,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import {
  ProfileAttributeSearchType,
  ProfileAttributeType,
} from "../../../navigator-data/src/accessors/attribute-profile";

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

        {import.meta.env.DEV && (
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  {/* `as string` bypasses TanStack Router's typed-route check: this shared
                      feature package can't see either app's generated route tree, but
                      /config exists in both apps. */}
                  <Link to={"/config" as string}>
                    <GearIcon aria-hidden />
                    <span>App selector</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        )}
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
// EntityDetailPage — $entity route component (reads path + s.cursor search param)
// ---------------------------------------------------------------------------

export function EntityDetailPage() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const cursor = (useSearch({ strict: false }) as EntitySearchState)["s.cursor"];
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;

  const profileResults = useProfileEntities();
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const isLoadingProfiles = profileResults.length > 0 && profileResults.every((r) => r.isPending);

  const profile = loadedProfiles.find((p) => p.name === entityName);

  const onCursorChange = useCallback(
    (url: string | undefined) => {
      const go = navigate as unknown as AnyNavigateFn;
      if (url) {
        go({ search: (prev) => ({ ...prev, "s.cursor": url }) });
      } else {
        go({
          search: (prev) => {
            const next = { ...prev };
            delete next["s.cursor"];
            return next;
          },
        });
      }
    },
    [navigate],
  );

  function onRowClick(id: string) {
    go({ to: "/$entity/$itemId", params: { entity: entityName, itemId: id } });
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
      pageUrl={cursor}
      onPageUrlChange={onCursorChange}
      onRowClick={onRowClick}
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
  const typeLabel = `entity type${count === 1 ? "" : "s"}`;
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Loading…" : `${count} ${typeLabel} available`}
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
  onRowClick,
  onBack,
}: Readonly<{
  profile: ProfileEntity;
  pageUrl: string | undefined;
  onPageUrlChange: (url: string | undefined) => void;
  onRowClick: (id: string) => void;
  onBack: () => void;
}>) {
  const collection = useEntityItemCollection(
    pageUrl ? { url: pageUrl, profileEntity: profile } : { profileEntity: profile },
  );

  // The data layer's origin guard (use-entity-item-collection.ts) silently
  // falls back to the first page when pageUrl is not same-origin with the
  // API base — it never throws. Without this effect, a stale/tampered
  // s.cursor would keep showing up in the URL forever even though it's being
  // ignored. Clear it so the URL reflects what is actually being fetched.
  const { profileUrl: apiBaseUrl } = useNavigatorData();
  useEffect(() => {
    if (pageUrl && resolveTrustedCollectionUrl(pageUrl, apiBaseUrl) === null) {
      onPageUrlChange(undefined);
    }
  }, [pageUrl, apiBaseUrl, onPageUrlChange]);

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
              {collection.data.totalItems.count === 1 ? "" : "s"}
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
          <p>
            Failed to load {profile.pluralName}: {collection.error.message}
          </p>
          {/* A cursor is opaque, ephemeral and filter-scoped: a bookmarked,
              shared or expired s.cursor makes the server reject the request
              and would otherwise strand the user on an unrecoverable URL.
              Offer a reset to the first page whenever a cursor was active. */}
          {pageUrl && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onPageUrlChange(undefined)}
            >
              Back to first page
            </Button>
          )}
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
            onRowClick={onRowClick}
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
// EntityItemDetailPage — $entity/$itemId route component
// ---------------------------------------------------------------------------

export function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false }) as {
    entity: string;
    itemId: string;
  };

  const profileResults = useProfileEntities();
  const isLoadingProfiles = profileResults.length > 0 && profileResults.every((r) => r.isPending);
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const profile = loadedProfiles.find((p) => p.name === entityName);

  if (isLoadingProfiles || (!profile && profileResults.length > 0)) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-md" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!profile) return null;

  return <EntityItemDetailView profile={profile} itemId={itemId} />;
}

function EntityItemDetailView({
  profile,
  itemId,
}: Readonly<{ profile: ProfileEntity; itemId: string }>) {
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;
  const item = useEntityItem({ profileEntity: profile, entityId: itemId });

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <button
              type="button"
              onClick={() => go({ to: "/", search: {} })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              All entities
            </button>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <button
              type="button"
              onClick={() => go({ to: "/$entity", params: { entity: profile.name } })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {profile.pluralName}
            </button>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{itemId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Separator />

      <h1 className="text-2xl font-bold tracking-tight">{profile.pluralName} detail</h1>

      {item.isPending && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {item.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load item: {item.error.message}
        </div>
      )}

      {item.isSuccess && (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {item.data.userDefinedAttributes.map((attr) => {
              const label =
                profile.attributes.find((a) => a.name === attr.value.name)?.title ??
                attr.value.name;
              return (
                <div key={attr.value.name} className="rounded-lg border p-4">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate text-sm">{renderAttributeValue(attr)}</dd>
                </div>
              );
            })}
          </dl>

          {(item.data.toOneRelations.length > 0 || item.data.toManyRelations.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Relations</h2>
                {item.data.toOneRelations.map((rel) => (
                  <RelationToOneSection key={rel.name} relation={rel} />
                ))}
                {item.data.toManyRelations.map((rel) => (
                  <RelationToManySection key={rel.name} relation={rel} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relation section components — each owns its own hook call (Rules of Hooks)
// ---------------------------------------------------------------------------

function RelationToOneSection({ relation }: Readonly<{ relation: EntityItemToOneRelation }>) {
  const go = useNavigate() as unknown as AnyNavigateFn;
  const result = useEntityItemToOneRelation(relation);
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation);
  const {
    mutate: setRelation,
    isPending: isSetting,
    error: setError,
  } = useSetToOneRelation(relation);
  const mutationError = clearError ?? setError;
  const [linkOpen, setLinkOpen] = useState(false);
  const profileResults = useProfileEntities();
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const targetProfile = relation.profileRelation.getTargetProfile(loadedProfiles);
  const title = relation.profileRelation.title ?? relation.name;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {relation.canSet && targetProfile && result.isSuccess && result.data === null && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isSetting}
                onClick={() => setLinkOpen(true)}
              >
                Link
              </Button>
              <RelationItemSearchDialog
                targetProfile={targetProfile}
                open={linkOpen}
                onOpenChange={setLinkOpen}
                onSelect={(item) => setRelation(item.selfLink.href)}
              />
            </>
          )}
          {relation.canClear && result.isSuccess && result.data !== null && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearing}>
                  {isClearing ? "Unlinking…" : "Unlink"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the link to this {title}. The linked item will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearRelation()}>Unlink</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      {mutationError && <MutationErrorDisplay error={mutationError} />}
      {result.isPending && <Skeleton className="h-12 w-full rounded-md" />}
      {result.isError && (
        <p className="text-xs text-destructive">Failed to load: {result.error.message}</p>
      )}
      {result.isSuccess && result.data === null && (
        <p className="text-sm text-muted-foreground">No item linked</p>
      )}
      {result.isSuccess && result.data !== null && (
        <button
          type="button"
          className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer"
          onClick={() => {
            const linked = result.data;
            if (!linked) return;
            go({
              to: "/$entity/$itemId" as string,
              params: { entity: linked.profileEntity.name, itemId: linked.id },
            });
          }}
        >
          <dl className="grid grid-cols-2 gap-2">
            {result.data.userDefinedAttributes.slice(0, 4).map((attr) => {
              const label =
                result.data!.profileEntity.attributes.find((a) => a.name === attr.value.name)
                  ?.title ?? attr.value.name;
              return (
                <div key={attr.value.name}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm truncate">{renderAttributeValue(attr)}</dd>
                </div>
              );
            })}
          </dl>
        </button>
      )}
    </div>
  );
}

function RelationToManySection({ relation }: Readonly<{ relation: EntityItemToManyRelation }>) {
  const go = useNavigate() as unknown as AnyNavigateFn;
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  const result = useEntityItemToManyRelation(relation, pageUrl ? { url: pageUrl } : undefined);
  const {
    mutate: clearRelation,
    isPending: isClearing,
    error: clearError,
  } = useClearRelation(relation, {
    mutationOptions: { onSuccess: () => setPageUrl(undefined) },
  });
  const {
    mutate: addRelation,
    isPending: isAdding,
    error: addError,
  } = useAddToManyRelation(relation);
  const {
    mutate: unlinkItem,
    isPending: isUnlinking,
    error: unlinkError,
  } = useUnlinkRelation(relation);
  const {
    mutate: deleteItem,
    isPending: isDeleting,
    error: deleteError,
  } = useDeleteRelationItem(relation);
  const mutationError = clearError ?? addError ?? unlinkError ?? deleteError;
  const [addOpen, setAddOpen] = useState(false);
  const profileResults = useProfileEntities();
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const targetProfile = relation.profileRelation.getTargetProfile(loadedProfiles);
  const title = relation.profileRelation.title ?? relation.name;

  const columns = targetProfile ? buildColumns(targetProfile) : [{ key: "id", header: "ID" }];
  const rows = result.isSuccess ? buildRows(result.data.items, columns) : [];
  const total = result.isSuccess ? result.data.totalItems : undefined;

  function onRowClick(id: string) {
    if (!targetProfile) return;
    go({ to: "/$entity/$itemId" as string, params: { entity: targetProfile.name, itemId: id } });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {total !== undefined && (
            <Badge variant="secondary">
              {total.count.toLocaleString()} item{total.count === 1 ? "" : "s"}
              {total.isEstimated && " (est.)"}
            </Badge>
          )}
          {relation.canAdd && targetProfile && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isAdding}
                onClick={() => setAddOpen(true)}
              >
                Add
              </Button>
              <RelationItemSearchDialog
                targetProfile={targetProfile}
                open={addOpen}
                onOpenChange={setAddOpen}
                onSelect={(item) => addRelation([item.selfLink.href])}
              />
            </>
          )}
          {relation.canClear && result.isSuccess && result.data.items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearing}>
                  {isClearing ? "Clearing…" : "Clear all"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all {total?.count.toLocaleString() ?? "linked"} item
                    {total?.count === 1 ? "" : "s"}. The items themselves will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearRelation()}>Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      {mutationError && <MutationErrorDisplay error={mutationError} />}
      {result.isPending && <Skeleton className="h-12 w-full rounded-md" />}
      {result.isError && (
        <p className="text-xs text-destructive">Failed to load: {result.error.message}</p>
      )}
      {result.isSuccess && result.data.isEmpty && (
        <p className="text-sm text-muted-foreground">No items linked</p>
      )}
      {result.isSuccess && !result.data.isEmpty && (
        <div className="space-y-3">
          <DataTable
            entityName={relation.name}
            entityTitle={title}
            columns={columns}
            rows={rows}
            onRowClick={onRowClick}
            onUnlink={
              relation.canUnlinkItem
                ? (id) => {
                    const item = result.data.findById(id);
                    if (item) unlinkItem(item);
                  }
                : undefined
            }
            isUnlinking={isUnlinking}
            onDelete={
              result.data.items.some((i) => i.canDelete)
                ? (id) => {
                    const item = result.data.findById(id);
                    if (item?.canDelete) deleteItem(item);
                  }
                : undefined
            }
            isDeleting={isDeleting}
          />
          {(result.data.hasNext || result.data.hasPrevious) && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!result.data.hasPrevious}
                onClick={() => setPageUrl(result.data.prevHref)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {result.data.pageSize} items on this page
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!result.data.hasNext}
                onClick={() => setPageUrl(result.data.nextHref)}
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

function renderAttributeValue(attr: EntityItemAttribute): string {
  switch (attr.value.kind) {
    case AttributeKind.PLAIN:
      return attr.value.value == null ? "—" : String(attr.value.value);
    case AttributeKind.CONTENT:
      return attr.value.metadata?.filename ?? "—";
    case AttributeKind.NESTED:
      return "(object)";
    default:
      return "—";
  }
}

// ---------------------------------------------------------------------------
// RelationItemSearchDialog — search and select an entity item to link
// ---------------------------------------------------------------------------

/**
 * Builds the search values for the relation-item search dialog: applies the
 * query text to the given search property when both are present, otherwise
 * returns the template's default (empty) values.
 */
function buildRelationSearchValues(
  searchTemplate: NonNullable<ProfileEntity["searchTemplate"]>,
  query: string,
  searchProperty:
    | ReturnType<NonNullable<ProfileEntity["searchTemplate"]>["getSearchPropertiesByType"]>[number]
    | undefined,
) {
  const values = createValues(searchTemplate.template);
  return query && searchProperty ? values.withValue(searchProperty.property.name, query) : values;
}

function RelationItemSearchDialog({
  targetProfile,
  open,
  onOpenChange,
  onSelect,
}: Readonly<{
  targetProfile: ProfileEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: EntityItem) => void;
}>) {
  const [query, setQuery] = useState("");

  const searchTemplate = targetProfile.searchTemplate;
  const searchProperty =
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.prefixMatch)[0] ??
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.fullText)[0];

  const searchValues = searchTemplate
    ? buildRelationSearchValues(searchTemplate, query, searchProperty)
    : undefined;

  const collection = useEntityItemCollection(
    searchValues !== undefined
      ? { profileEntity: targetProfile, searchValues }
      : { profileEntity: targetProfile },
  );

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {targetProfile.pluralName}</DialogTitle>
          <DialogDescription>Search for an item to link.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder={`Search ${targetProfile.pluralName}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {collection.isPending && <Skeleton className="h-40 w-full rounded-md" />}
        {collection.isError && (
          <p className="text-sm text-destructive">Failed to load: {collection.error.message}</p>
        )}
        {collection.isSuccess && collection.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
        )}
        {collection.isSuccess && collection.data.items.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {collection.data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors cursor-pointer"
                onClick={() => {
                  onSelect(item);
                  handleOpenChange(false);
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {item.userDefinedAttributes.slice(0, 4).map((attr) => {
                    const label =
                      targetProfile.attributes.find((a) => a.name === attr.value.name)?.title ??
                      attr.value.name;
                    return (
                      <div key={attr.value.name}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm truncate">{renderAttributeValue(attr)}</p>
                      </div>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MutationErrorDisplay — structured error from a failed relation mutation
// ---------------------------------------------------------------------------

function MutationErrorDisplay({ error }: Readonly<{ error: Error }>) {
  if (!(error instanceof ProblemDetailError)) {
    return <p className="text-xs text-destructive">{error.message}</p>;
  }
  const { status, title, detail, type } = error.problemDetail;
  const fieldErrors = extractFieldErrors(error);
  const problemTypeLabel = type ? type.split("/").findLast(Boolean) : undefined;
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{status}</span>
        <span className="font-medium">{title}</span>
        {detail && detail !== title && <span>{detail}</span>}
      </div>
      {problemTypeLabel && <p className="font-mono text-muted-foreground">{problemTypeLabel}</p>}
      {fieldErrors.length > 0 && (
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          {fieldErrors.map((fe) => (
            <li key={`${fe.property ?? ""}-${fe.detail ?? fe.title}`}>
              {fe.property && <span className="font-medium">{fe.property}: </span>}
              {fe.detail ?? fe.title}
            </li>
          ))}
        </ul>
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
