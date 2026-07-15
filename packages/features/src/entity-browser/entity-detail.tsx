import { useCallback } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  type EntityItem,
  type EntitySearchState,
  type ProfileEntity,
  createValues,
  extractCursorFromHref,
  useCreateEntityItem,
  useEntityItemCollection,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  ErrorPage,
  LoadingPage,
  Separator,
  Skeleton,
} from "@contentgrid/ui";
import { formatAttributeValue } from "./attribute-format";
import type { AnyNavigateFn } from "./navigate";

// ---------------------------------------------------------------------------
// EntityDetailPage — $entity route component (reads path + cursor search param)
// ---------------------------------------------------------------------------

export function EntityDetailPage() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const searchState = useSearch({ strict: false }) as EntitySearchState;
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;

  // EntityProfileGate (the parent /$entity route) already resolved and
  // validated the profile before this renders — this is a cached read.
  const { data: profile } = useProfileEntity({ name: entityName });

  // Merges a patch into the URL's search state, one field at a time — not
  // specific to `cursor`. A future field (sort, filters, ...) reuses this
  // same setter instead of a new one-off callback.
  const onSearchStateChange = useCallback(
    (patch: Partial<EntitySearchState>) => {
      go({
        search: (prev) => {
          const next = { ...prev, ...patch };
          for (const key of Object.keys(patch)) {
            if (patch[key] === undefined) delete next[key];
          }
          return next;
        },
      });
    },
    [navigate],
  );

  function onRowClick(id: string) {
    // Carry the current search state (e.g. cursor) forward so navigating back
    // from the item to the list restores the same page instead of resetting
    // to the first one.
    go({
      to: "/$entity/$itemId",
      params: { entity: entityName, itemId: id },
      search: (prev) => prev,
    });
  }

  function onBack() {
    go({ to: "/", search: {} });
  }

  if (!profile) return null;

  return (
    <EntityDetailView
      profile={profile}
      searchState={searchState}
      onSearchStateChange={onSearchStateChange}
      onRowClick={onRowClick}
      onBack={onBack}
    />
  );
}

// ---------------------------------------------------------------------------
// Detail view — breadcrumb + EntityCollection (table + pagination)
// ---------------------------------------------------------------------------

function EntityDetailView({
  profile,
  searchState,
  onSearchStateChange,
  onRowClick,
  onBack,
}: Readonly<{
  profile: ProfileEntity;
  searchState: EntitySearchState;
  onSearchStateChange: (patch: Partial<EntitySearchState>) => void;
  onRowClick: (id: string) => void;
  onBack: () => void;
}>) {
  const { cursor } = searchState;
  const searchParams = new URLSearchParams(cursor ? { cursor } : undefined);
  const collection = useEntityItemCollection({ profileEntity: profile, searchParams });

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

      {collection.isPending && <LoadingPage rows={5} />}

      {/* A cursor is opaque, ephemeral and filter-scoped: a bookmarked, shared
          or expired cursor makes the server reject the request. Offer a
          reset to the first page whenever a cursor was active. */}
      {collection.isError && (
        <ErrorPage
          message={`Failed to load ${profile.pluralName}: ${collection.error.message}`}
          onRetry={cursor ? () => onSearchStateChange({ cursor: undefined }) : undefined}
          retryLabel="Back to first page"
        />
      )}

      {collection.isSuccess && (
        <div className="space-y-4">
          <DataTable
            entityName={profile.name}
            entityTitle={profile.pluralName}
            columns={columns}
            rows={rows}
            onRowClick={onRowClick}
          />

          {(collection.data.hasNext || collection.data.hasPrevious) && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!collection.data.hasPrevious}
                onClick={() => {
                  onSearchStateChange({ cursor: extractCursorFromHref(collection.data.prevHref) });
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
                  onSearchStateChange({ cursor: extractCursorFromHref(collection.data.nextHref) });
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

export function buildColumns(profile: ProfileEntity): DataTableColumn[] {
  const userAttrs = profile.userDefinedAttributes.slice(0, MAX_COLUMNS);

  if (userAttrs.length === 0) {
    return [{ key: "id", header: "ID" }];
  }

  return userAttrs.map((attr) => ({
    key: attr.name,
    header: attr.title ?? attr.name,
  }));
}

export function buildRows(
  items: readonly EntityItem[],
  columns: DataTableColumn[],
): DataTableRow[] {
  const columnKeys = new Set(columns.map((c) => c.key));

  return items.map((item) => {
    const data: Record<string, unknown> = {};

    if (columnKeys.has("id")) {
      data["id"] = item.halItem.data.id;
    }

    for (const attr of item.userDefinedAttributes) {
      if (!columnKeys.has(attr.value.name)) continue;
      data[attr.value.name] = formatAttributeValue(attr);
    }

    return { id: String(item.halItem.data.id), data };
  });
}
