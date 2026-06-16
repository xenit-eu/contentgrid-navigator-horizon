import type { ReactNode } from "react";
import { useState } from "react";
import {
  AttributeKind,
  ProfileEntity,
  useEntityItemCollection,
  useProfileEntities,
} from "@contentgrid/navigator-data";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@contentgrid/ui";

export function EntityList() {
  const profiles = useProfileEntities();

  if (profiles.isPending) {
    return <EntityListMessage>Loading entities…</EntityListMessage>;
  }
  if (profiles.isError) {
    return <EntityListMessage>Failed to load entities: {profiles.error.message}</EntityListMessage>;
  }
  if (profiles.data.length == 0) {
    return <EntityListMessage>No entities with name found.</EntityListMessage>;
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.data.map((entityProfile) => (
        <EntityCollectionCard key={entityProfile.name} profile={entityProfile} />
      ))}
    </div>
  );
}

function EntityListMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{children}</p>
      </CardContent>
    </Card>
  );
}

function EntityCollectionCard({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const collection = useEntityItemCollection(profile.name);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {profile.pluralName}
          {collection.isSuccess && collection.data.totalItems && (
            <Badge variant="secondary">
              {collection.data.totalItems.count}
              {collection.data.totalItems.isEstimated && " (est.)"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {collection.isPending && <p className="text-muted-foreground text-sm">Loading items…</p>}
        {collection.isError && (
          <p className="text-muted-foreground text-sm">
            Failed to load items: {collection.error.message}
          </p>
        )}
        {collection.isSuccess && (
          <div className="space-y-4">
            {/* Collection metadata */}
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">Collection Metadata</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Page Size:</span>{" "}
                  <span className="font-mono">{collection.data.pageSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Items:</span>{" "}
                  <span className="font-mono">
                    {collection.data.totalItems?.count ?? "unknown"}
                    {collection.data.totalItems?.isEstimated && " (estimated)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Has Next:</span>{" "}
                  <Badge
                    variant={collection.data.hasNext ? "default" : "outline"}
                    className="text-xs"
                  >
                    {collection.data.hasNext ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Has Previous:</span>{" "}
                  <Badge
                    variant={collection.data.hasPrevious ? "default" : "outline"}
                    className="text-xs"
                  >
                    {collection.data.hasPrevious ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Is Empty:</span>{" "}
                  <Badge
                    variant={collection.data.isEmpty ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {collection.data.isEmpty ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Entity Profile:</span>{" "}
                  <span className="font-mono text-xs">{collection.data.profileEntity.name}</span>
                </div>
              </div>
              {collection.data.nextHref && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Next Page URL:</span>{" "}
                  <span className="font-mono break-all text-[10px]">
                    {collection.data.nextHref}
                  </span>
                </div>
              )}
            </div>

            {/* Items list */}
            {collection.data.items.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Items ({collection.data.items.length})</h4>
                {collection.data.items.map((item, idx) => (
                  <Card key={idx} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold">
                            {item.halItem.data.id as string}
                          </span>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              {item.attributes.length} total attrs
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {item.userDefinedAttributes.length} user-defined
                            </Badge>
                            {item.contentLinks.length > 0 && (
                              <Badge variant="default" className="text-xs">
                                {item.contentLinks.length} files
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleItem(idx)}
                          className="rounded px-3 py-1 text-xs hover:bg-accent"
                        >
                          {expandedItems.has(idx) ? "Collapse" : "Expand"}
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Quick summary - always visible */}
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold">Quick View</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {item.userDefinedAttributes.slice(0, 4).map((attr) => (
                            <div key={attr.value.name} className="text-xs">
                              <span className="text-muted-foreground">
                                {attr.profileAttribute?.title ?? attr.value.name}:
                              </span>{" "}
                              <span className="font-mono">
                                {attr.value.kind === AttributeKind.PLAIN
                                  ? String(attr.value.value)
                                  : attr.value.kind === AttributeKind.CONTENT
                                    ? `[file: ${attr.value.metadata?.filename ?? "unnamed"}]`
                                    : attr.value.kind === AttributeKind.NESTED
                                      ? `[object: ${attr.value.attributes.length} fields]`
                                      : "[unknown]"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detailed sections - collapsible */}
                      {expandedItems.has(idx) && (
                        <div className="space-y-3 border-t pt-3">
                          {/* All User-Defined Attributes */}
                          <div>
                            <h5 className="mb-2 text-xs font-semibold">
                              User-Defined Attributes ({item.userDefinedAttributes.length})
                            </h5>
                            <div className="space-y-2">
                              {item.userDefinedAttributes.map((attr) => (
                                <div key={attr.value.name} className="rounded border bg-muted p-2">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="font-mono text-xs font-medium">
                                      {attr.value.name}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {attr.value.kind === AttributeKind.PLAIN
                                        ? "plain"
                                        : attr.value.kind === AttributeKind.CONTENT
                                          ? "content"
                                          : attr.value.kind === AttributeKind.NESTED
                                            ? "nested"
                                            : "unknown"}
                                    </Badge>
                                    {attr.profileAttribute && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {attr.profileAttribute.type}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground space-y-1 text-[10px]">
                                    {attr.profileAttribute && (
                                      <>
                                        <p>Title: {attr.profileAttribute.title}</p>
                                        {attr.profileAttribute.description && (
                                          <p>Description: {attr.profileAttribute.description}</p>
                                        )}
                                      </>
                                    )}
                                    <div className="mt-1">
                                      <span className="font-semibold">Value:</span>{" "}
                                      {attr.value.kind === AttributeKind.PLAIN ? (
                                        <span className="font-mono">
                                          {JSON.stringify(attr.value.value)}
                                        </span>
                                      ) : attr.value.kind === AttributeKind.CONTENT ? (
                                        <div className="mt-1 space-y-1">
                                          <p>Filename: {attr.value.metadata?.filename ?? "null"}</p>
                                          <p>
                                            MIME Type: {attr.value.metadata?.mimetype ?? "null"}
                                          </p>
                                          <p>Size: {attr.value.metadata?.length ?? 0} bytes</p>
                                          <p className="font-mono">Link: {attr.value.link.href}</p>
                                        </div>
                                      ) : attr.value.kind === AttributeKind.NESTED ? (
                                        <div className="mt-1 space-y-1">
                                          <p>Nested fields: {attr.value.attributes.length}</p>
                                          {attr.value.attributes.map((nested) => (
                                            <div
                                              key={nested.value.name}
                                              className="ml-3 border-l-2 pl-2"
                                            >
                                              <span className="font-mono">
                                                {nested.value.name}:
                                              </span>{" "}
                                              {nested.value.kind === AttributeKind.PLAIN
                                                ? JSON.stringify(nested.value.value)
                                                : "[complex]"}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span>[unknown type]</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Audit Attributes */}
                          {item.auditAttributes.length > 0 && (
                            <div>
                              <h5 className="mb-2 text-xs font-semibold">
                                Audit Attributes ({item.auditAttributes.length})
                              </h5>
                              <div className="space-y-1 rounded border bg-amber-50 p-2">
                                {item.auditAttributes.map((attr) => (
                                  <div
                                    key={attr.value.name}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <span className="text-muted-foreground font-mono">
                                      {attr.value.name}:
                                    </span>
                                    <span className="font-mono">
                                      {attr.value.kind === AttributeKind.PLAIN
                                        ? String(attr.value.value)
                                        : "[complex]"}
                                    </span>
                                    {attr.profileAttribute && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {attr.profileAttribute.type}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Content Links */}
                          {item.contentLinks.length > 0 && (
                            <div>
                              <h5 className="mb-2 text-xs font-semibold">
                                Content Links ({item.contentLinks.length})
                              </h5>
                              <div className="space-y-1">
                                {item.contentLinks.map((link, linkIdx) => (
                                  <div key={linkIdx} className="rounded border p-2 text-[10px]">
                                    <p>
                                      <span className="text-muted-foreground">Name:</span>{" "}
                                      <span className="font-mono">{link.name ?? "(unnamed)"}</span>
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">Href:</span>{" "}
                                      <span className="font-mono break-all">{link.href}</span>
                                    </p>
                                    {link.type && (
                                      <p>
                                        <span className="text-muted-foreground">Type:</span>{" "}
                                        <span>{link.type}</span>
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Available Template */}
                          {item.defaultTemplate && (
                            <div>
                              <h5 className="mb-2 text-xs font-semibold">
                                Default Update Template
                              </h5>
                              <div className="rounded border p-2 text-[10px]">
                                <p>
                                  <span className="text-muted-foreground">Method:</span>{" "}
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.defaultTemplate.request.method}
                                  </Badge>
                                </p>
                                <p className="mt-1">
                                  <span className="text-muted-foreground">Target:</span>{" "}
                                  <span className="font-mono break-all">
                                    {item.defaultTemplate.request.url}
                                  </span>
                                </p>
                                <p className="mt-1">
                                  <span className="text-muted-foreground">Content-Type:</span>{" "}
                                  <span className="font-mono">
                                    {item.defaultTemplate.contentType}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Raw HAL Data */}
                          <div>
                            <Collapsible>
                              <CollapsibleTrigger className="flex w-full items-center justify-between rounded border p-2 text-xs hover:bg-accent">
                                <span className="font-semibold">Raw HAL Item Data</span>
                                <span>Show/Hide</span>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <pre className="text-muted-foreground max-h-96 overflow-auto rounded border bg-muted p-3 text-[9px]">
                                  {JSON.stringify(item.halItem.data, null, 2)}
                                </pre>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No items in this collection</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
