import { StackIcon } from "@phosphor-icons/react";
import {
  type CollectionTotalCount,
  type ProfileEntity,
  useEntityItemCollection,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertDescription,
  AlertTitle,
  EntityCard,
  EntityCardArrow,
  EntityCardDescription,
  EntityCardGrid,
  EntityCardSkeleton,
  EntityCardText,
  EntityCardTitle,
  formatCount,
  pluralize,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";

// ---------------------------------------------------------------------------
// EntityCountOverview — the Home page body (grid of entity cards)
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
  const { profiles: loadedProfiles, isLoading, error, refetch } = useLoadedProfileEntities();

  if (error) {
    return (
      <Alert tone="error">
        <AlertTitle>The application couldn't be loaded</AlertTitle>
        <AlertDescription>Try again in a moment.</AlertDescription>
        <AlertActionSection>
          <AlertButton onClick={refetch}>Try again</AlertButton>
        </AlertActionSection>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <EntityCardGrid>
        {[1, 2, 3, 4].map((i) => (
          <EntityCardSkeleton key={i} />
        ))}
      </EntityCardGrid>
    );
  }

  if (loadedProfiles.length === 0) {
    return <NoEntitiesState />;
  }

  return (
    <EntityCardGrid>
      {loadedProfiles.map((profile) => (
        <EntityCardConnected
          key={profile.name}
          profile={profile}
          onSelect={() => onSelectEntity(profile)}
        />
      ))}
    </EntityCardGrid>
  );
}

/** Shown when the profile lists no entities, or none the user can access. */
function NoEntitiesState() {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center text-muted-foreground">
      <span className="grid size-14 place-items-center rounded-[14px] border-[1.5px] border-dashed border-info-border bg-info text-info-foreground">
        <StackIcon aria-hidden className="size-6" />
      </span>
      <h2 className="text-[17px] font-bold text-foreground">Nothing to show yet</h2>
      <p className="max-w-[44ch] text-sm">
        This application has no entities, or you don't have access to any. Contact an administrator.
      </p>
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
      <ItemCountLine total={collection.data?.totalItems} loading={collection.isFetching} />
    </EntityCard>
  );
}

/**
 * "1 item", "1 284 items", "about 1 204 items" for an estimate, "0 items"; a dash while the count
 * loads, and "Count not available" when there is none (the request failed, or the entity can't be
 * searched).
 */
function ItemCountLine({
  total,
  loading,
}: Readonly<{ total: CollectionTotalCount | undefined; loading: boolean }>) {
  const count = formatCount(total, { estimate: "word" });
  if (!total || count === undefined) {
    return (
      <p className="mt-auto text-ui text-muted-foreground">
        {loading ? "—" : "Count not available"}
      </p>
    );
  }
  return (
    <p className="mt-auto text-ui text-muted-foreground">
      <span className="font-bold text-card-foreground">{count}</span>{" "}
      {pluralize(total.count, "item")}
    </p>
  );
}
