import { useNavigate } from "@tanstack/react-router";
import {
  type ProfileEntity,
  useEntityItemCollection,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { EntityCard, Skeleton } from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// EntityOverviewPage — index route component (grid of entity cards)
// ---------------------------------------------------------------------------

export function EntityCountOverview() {
  const go = useNavigate();

  return (
    <EntityOverview
      onSelectEntity={(profile) => go({ to: "/$entity", params: { entity: profile.name } })}
    />
  );
}

// ---------------------------------------------------------------------------
// Overview — grid of EntityCard components
// ---------------------------------------------------------------------------

function EntityOverview({
  onSelectEntity,
}: Readonly<{ onSelectEntity: (profile: ProfileEntity) => void }>) {
  const { profiles: loadedProfiles, isLoading } = useLoadedProfileEntities();

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
      hasContent={profile.hasContentAttributes}
      onTitleClick={onSelect}
      onCreateClick={onSelect}
    />
  );
}
