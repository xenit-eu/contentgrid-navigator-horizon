import type { ReactNode } from "react";
import { ProfileEntity, useEntityList, useProfileEntities } from "@contentgrid/navigator-data";
import { Card, CardContent, CardHeader, CardTitle } from "@contentgrid/ui";

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
  const list = useEntityList(profile.name, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.pluralName}</CardTitle>
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
