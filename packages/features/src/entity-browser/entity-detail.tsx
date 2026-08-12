import { useCallback, useMemo } from "react";
import { skipToken, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import {
  type EntityItem,
  type EntitySearchState,
  type ProfileEntity,
  createValues,
  extractCursorFromHref,
  getErrorMessage,
  registerCursorHref,
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
import type { AppRouterContext } from "../shells/router-shell/router-context";
import { formatAttributeValue } from "./attribute-format";
import { useTypedNavigate } from "./navigate";

// ---------------------------------------------------------------------------
// Route loader — shared by both apps' $entity/index.tsx route files.
// TanStack Router requires a per-app route file, but the prefetch logic itself
// is identical, so it lives here once instead of being copy-pasted twice.
// ---------------------------------------------------------------------------

interface EntityDetailLoaderContext extends AppRouterContext {
  /**
   * `null` when the parent `$entity` beforeLoad prefetch resolved to no profile,
   * absent entirely when it bailed out early — both mean "not prefetched".
   */
  profileEntity?: ProfileEntity | null;
}

export async function ensureEntityDetailLoaderData(
  context: EntityDetailLoaderContext,
): Promise<void> {
  const { apiFetch, profileUrl, profileEntity } = context;
  // apiFetch/profileUrl stay null until the auth-gated router-context bridge in
  // main.tsx fires; profileEntity is absent when the parent $entity beforeLoad
  // prefetch was skipped or failed. In each case skip prefetching and let
  // EntityDetailPage's own useEntityItemCollection() fetch normally.
  if (!apiFetch || !profileUrl || !profileEntity) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- placeholder loader; real prefetch call replaces this
    skipToken;
  } catch {
    // Swallowed: an uncaught loader rejection would block EntityDetailPage
    // from mounting at all. useEntityItemCollection's own isError handling
    // takes over once the component renders.
  }
}

// ---------------------------------------------------------------------------
// EntityDetailPage — $entity route component (reads path + cursor search param)
// ---------------------------------------------------------------------------

export function EntityDetailPage() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const searchState = useSearch({ strict: false }) as EntitySearchState;
  const go = useTypedNavigate();

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
    [go],
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
  const collection = useEntityItemCollection({ profileEntity: profile });
  const queryClient = useQueryClient();

  // Navigating to a next/prev page never constructs a URL: `cursorParam` (same
  // name as the legacy navigator's CollectionSearch.tsx) is opaque route state
  // only, and the literal href it was extracted from is remembered in the
  // cursor registry (keyed by the same value) at the one moment it's actually
  // in hand — right here, before it ever reaches the URL. The data layer
  // resolves the cursor back to this href via the registry; it never rebuilds
  // one from parts.
  function onPageChange(href: string | undefined) {
    const cursorParam = extractCursorFromHref(href);
    if (cursorParam && href) registerCursorHref(queryClient, profile.name, cursorParam, href);
    onSearchStateChange({ cursor: cursorParam });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const columns = useMemo(() => buildColumns(profile), [profile]);
  const rows = useMemo(
    () => (collection.data ? buildRows(collection.data.items, columns) : []),
    [collection.data, columns],
  );

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
          message={`Failed to load ${profile.pluralName}: ${getErrorMessage(collection.error)}`}
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
                onClick={() => onPageChange(collection.data.prevHref)}
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
                onClick={() => onPageChange(collection.data.nextHref)}
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
      {error && <p className="text-xs text-destructive">{getErrorMessage(error)}</p>}
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
      data["id"] = item.id;
    }

    for (const attr of item.userDefinedAttributes) {
      if (!columnKeys.has(attr.value.name)) continue;
      data[attr.value.name] = formatAttributeValue(attr);
    }

    return { id: item.id, data };
  });
}
