import { AttributeKind, ProfileEntity, useRecentlyCreated } from "@contentgrid/navigator-data";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentgrid/ui";

export function RecentlyCreatedList({ profileEntity }: Readonly<{ profileEntity: ProfileEntity }>) {
  const { data, isPending, isError, error } = useRecentlyCreated(profileEntity);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently Created — {profileEntity.pluralName}</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {isError && (
          <p className="text-muted-foreground text-sm">Failed to load: {error.message}</p>
        )}
        {data && data.isEmpty && <p className="text-muted-foreground text-sm">No items found.</p>}
        {data && !data.isEmpty && (
          <ul className="divide-y">
            {data.items.map((item) => {
              const id = item.halItem.data.id as string;
              const createdAt = item.auditAttributes.find((a) => a.profileAttribute?.isCreatedDate);
              const createdBy = item.auditAttributes.find((a) => a.profileAttribute?.isCreatedBy);

              return (
                <li key={id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{id}</span>
                    {createdAt?.value.kind === AttributeKind.PLAIN && createdAt.value.value && (
                      <Badge variant="outline" className="text-xs">
                        {String(createdAt.value.value)}
                      </Badge>
                    )}
                    {createdBy?.value.kind === AttributeKind.PLAIN && createdBy.value.value && (
                      <span className="text-muted-foreground text-xs">
                        by {String(createdBy.value.value)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.userDefinedAttributes.slice(0, 4).map((attr) => (
                      <span key={attr.value.name} className="text-muted-foreground text-xs">
                        <span className="font-medium">
                          {attr.profileAttribute?.title ?? attr.value.name}:
                        </span>{" "}
                        {attr.value.kind === AttributeKind.PLAIN
                          ? String(attr.value.value ?? "—")
                          : attr.value.kind === AttributeKind.CONTENT
                            ? `[file: ${attr.value.metadata?.filename ?? "unnamed"}]`
                            : attr.value.kind === AttributeKind.NESTED
                              ? `[object]`
                              : "—"}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
