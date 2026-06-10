import type { ReactNode } from "react";
import { type EntityInfo, useEntityList, useProfile } from "@contentgrid/navigator-data";
import { Card, CardContent, CardHeader, CardTitle } from "@contentgrid/ui";

export function EntityList() {
  const profile = useProfile();

  if (profile.isPending) {
    return <EntityListMessage>Loading entities…</EntityListMessage>;
  }
  if (profile.isError) {
    return <EntityListMessage>Failed to load entities: {profile.error.message}</EntityListMessage>;
  }
  if (profile.data.length === 0) {
    return <EntityListMessage>No entities found.</EntityListMessage>;
  }

  return (
    <div className="flex flex-col gap-4">
      {profile.data.map((entity) => (
        <EntityCollectionCard key={entity.name} entity={entity} />
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

function EntityCollectionCard({ entity }: Readonly<{ entity: EntityInfo }>) {
  const list = useEntityList(entity.name, {});

  return (
    <Card>
      <CardHeader>
        {/* aria-label = entity.title so screen readers announce the entity name;
            display text includes "· collection" so getByText(title, exact) finds
            only the sidebar nav link (avoids duplicate-text violations in Playwright). */}
        <CardTitle aria-label={entity.title}>{entity.title} · collection</CardTitle>
      </CardHeader>
      <CardContent>
        {list.isPending && <p className="text-muted-foreground text-sm">Loading items…</p>}
        {list.isError && (
          <p className="text-muted-foreground text-sm">
            Failed to load items: {list.error.message}
          </p>
        )}
        {list.isSuccess && (
          <>
            <p className="text-muted-foreground text-sm">
              {list.data.totalItems ?? list.data.items.length} item(s)
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {list.data.items.map((item) => (
                <li key={item.selfHref} className="text-sm">
                  {item.id}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
