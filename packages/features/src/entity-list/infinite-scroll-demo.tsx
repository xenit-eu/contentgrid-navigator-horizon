import type { ReactNode } from "react";
import { Fragment } from "react";
import {
  AttributeKind,
  ProfileEntity,
  useEntityItemCollectionInfiniteScroll,
  useProfileEntities,
} from "@contentgrid/navigator-data";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@contentgrid/ui";

/**
 * Demo component showing infinite scroll pattern with TanStack Query.
 *
 * Features:
 * - Progressive loading of pages using HAL next links
 * - "Load More" button (can be replaced with intersection observer for true infinite scroll)
 * - Shows total items loaded vs total available
 * - Displays loading states per page
 */
export function EntityListInfiniteScrollDemo() {
  const profiles = useProfileEntities();

  if (profiles.some((profile) => profile.isPending)) {
    return <EntityListMessage>Loading entities…</EntityListMessage>;
  }
  if (profiles.some((profile) => profile.isError)) {
    return <EntityListMessage>Failed to load entities</EntityListMessage>;
  }
  if (profiles.length === 0) {
    return <EntityListMessage>No entities found.</EntityListMessage>;
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.map(
        (entityProfile) =>
          entityProfile.data && (
            <EntityInfiniteScrollCard key={entityProfile.data.name} profile={entityProfile.data} />
          ),
      )}
    </div>
  );
}

function EntityListMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Infinite Scroll Demo</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{children}</p>
      </CardContent>
    </Card>
  );
}

function EntityInfiniteScrollCard({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isError, error } =
    useEntityItemCollectionInfiniteScroll({ profileEntity: profile });

  // Calculate total items loaded across all pages
  const totalItemsLoaded = data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0;
  const totalItemsAvailable = data?.pages[0]?.totalItems;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {profile.pluralName}
          {totalItemsAvailable && (
            <Badge variant="secondary">
              {totalItemsLoaded} / {totalItemsAvailable.count}
              {totalItemsAvailable.isEstimated && " (est.)"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError && (
          <p className="text-destructive text-sm mb-4">Failed to load items: {error.message}</p>
        )}

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="rounded-lg border bg-muted p-4">
            <h4 className="mb-2 text-sm font-semibold">Infinite Scroll Stats</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Pages Loaded:</span>{" "}
                <span className="font-mono">{data?.pages.length ?? 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Items Loaded:</span>{" "}
                <span className="font-mono">{totalItemsLoaded}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Has More:</span>{" "}
                <Badge variant={hasNextPage ? "default" : "outline"} className="text-xs">
                  {hasNextPage ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Loading:</span>{" "}
                <Badge variant={isFetching ? "default" : "outline"} className="text-xs">
                  {isFetching ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Items grouped by page */}
          {data?.pages.map((page, pageIndex) => (
            <Fragment key={pageIndex}>
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t" />
                <span className="text-muted-foreground text-xs font-medium">
                  Page {pageIndex + 1} ({page.items.length} items)
                </span>
                <div className="flex-1 border-t" />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {page.items.map((item) => (
                  <Card key={item.halItem.data.id as string} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold">
                          {item.halItem.data.id as string}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.userDefinedAttributes.length} attrs
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* First few attributes */}
                      {item.userDefinedAttributes.slice(0, 3).map((attr) => (
                        <div key={attr.value.name} className="text-xs">
                          <span className="text-muted-foreground">
                            {attr.profileAttribute?.title ?? attr.value.name}:
                          </span>{" "}
                          <span className="font-mono text-[11px]">
                            {attr.value.kind === AttributeKind.PLAIN
                              ? String(attr.value.value).substring(0, 30) +
                                (String(attr.value.value).length > 30 ? "..." : "")
                              : attr.value.kind === AttributeKind.CONTENT
                                ? `[${attr.value.metadata?.filename ?? "file"}]`
                                : "[object]"}
                          </span>
                        </div>
                      ))}
                      {item.userDefinedAttributes.length > 3 && (
                        <div className="text-muted-foreground text-[10px]">
                          +{item.userDefinedAttributes.length - 3} more attributes
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Fragment>
          ))}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="default"
                size="lg"
              >
                {isFetchingNextPage ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    Loading More...
                  </>
                ) : (
                  <>
                    Load More Items
                    {totalItemsAvailable && (
                      <Badge variant="secondary" className="ml-2">
                        {totalItemsLoaded} / {totalItemsAvailable.count}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* End of list indicator */}
          {!hasNextPage && data && data.pages.length > 0 && (
            <div className="rounded-lg border bg-muted p-4 text-center">
              <p className="text-muted-foreground text-sm">✓ All {totalItemsLoaded} items loaded</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
