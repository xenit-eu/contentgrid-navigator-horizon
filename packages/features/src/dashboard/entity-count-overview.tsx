import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import {
  EntityCard,
  EntityCardArrow,
  EntityCardDescription,
  EntityCardSkeleton,
  EntityCardText,
  EntityCardTitle,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";
import { ProblemAlert } from "../problem-details";

// ---------------------------------------------------------------------------
// EntityOverviewPage — index route component (grid of entity cards)
// ---------------------------------------------------------------------------

export function EntityCountOverview({
  onOpenEntity,
}: Readonly<{ onOpenEntity: (entityName: string) => void }>) {
  return <EntityOverview onSelectEntity={(profile) => onOpenEntity(profile.name)} />;
}

// ---------------------------------------------------------------------------
// Overview — grid of EntityCard components
// ---------------------------------------------------------------------------

function EntityOverview({
  onSelectEntity,
}: Readonly<{ onSelectEntity: (profile: ProfileEntity) => void }>) {
  const { profiles: loadedProfiles, isLoading, error } = useLoadedProfileEntities();

  if (error) {
    return (
      <ProblemAlert model={toProblemDisplayModel(error)} className="text-sm max-w-3xl mx-auto" />
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {[1, 2, 3, 4].map((i) => (
          <EntityCardSkeleton key={i} className="h-36" />
        ))}
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
      {loadedProfiles.map((profile) => (
        <EntityCardConnected
          key={profile.name}
          profile={profile}
          onSelect={() => onSelectEntity(profile)}
        />
      ))}
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
    <EntityCard onOpen={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <EntityIconBadge profile={profile} tinted />
        <EntityCardArrow />
      </div>
      <EntityCardText>
        <EntityCardTitle>{profile.pluralName}</EntityCardTitle>
        {profile.description && (
          <EntityCardDescription>{profile.description}</EntityCardDescription>
        )}
      </EntityCardText>
      <p className="mt-auto text-ui text-muted-foreground">
        <span className="font-bold text-card-foreground">
          {collection.data?.totalItems?.count ?? "—"}
        </span>{" "}
        items
      </p>
    </EntityCard>
  );
}
