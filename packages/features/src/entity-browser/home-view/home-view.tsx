import { Link } from "@tanstack/react-router";
import type { EntityInfo } from "@contentgrid/navigator-data";
import { useEntityCapabilities, useEntityList, useProfile } from "@contentgrid/navigator-data";
import { EntityCard, LogomarkColor, Skeleton } from "@contentgrid/ui";
import { getEntityVisuals } from "../entity-visuals";

// ---------------------------------------------------------------------------
// Per-entity child component — fetches count + capabilities without
// violating rules-of-hooks (no hooks inside .map())
// ---------------------------------------------------------------------------

interface EntityCardWithCountProps {
  entity: EntityInfo;
}

function EntityCardWithCount({ entity }: Readonly<EntityCardWithCountProps>) {
  const listResult = useEntityList(entity.name, { size: 1 });
  const capabilities = useEntityCapabilities(entity.name);

  const count = listResult.data?.totalItems;
  const { icon, accent } = getEntityVisuals(entity);

  function handleCreateClick() {
    // TODO(HZN-5A): wire to create form when entity creation is implemented.
  }

  return (
    <Link
      to="/$collection"
      params={{ collection: entity.name }}
      search={{ cursor: undefined, sort: undefined }}
      className="contents"
    >
      <EntityCard
        name={entity.name}
        title={entity.title}
        count={count}
        icon={icon}
        tint={accent}
        onCreateClick={capabilities.canCreate ? handleCreateClick : undefined}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------

function EntityCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--cg-color-card-border)] bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2.5">
        {/* Icon tile skeleton */}
        <Skeleton className="size-9 shrink-0 rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="size-7 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeView
// ---------------------------------------------------------------------------

export function HomeView() {
  const profile = useProfile();

  // Loading state — show skeleton grid while profile is loading
  if (profile.isPending) {
    return (
      <div className="px-8 py-9">
        <WelcomeHeader />
        <HomeDivider />
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-[0.04em] text-foreground">
            Entities
          </span>
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {["s1", "s2", "s3", "s4"].map((k) => (
            <EntityCardSkeleton key={k} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (profile.isError) {
    return (
      <div className="px-8 py-9">
        <WelcomeHeader />
        <div className="my-6 border-t border-border" />
        <p className="text-[13px] text-muted-foreground">
          Failed to load entities: {profile.error.message}
        </p>
      </div>
    );
  }

  const entities = profile.data;
  const entityCount = entities.length;

  return (
    <div className="px-8 py-9">
      <WelcomeHeader />

      <HomeDivider />

      {/* Section header */}
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-[0.04em] text-foreground">
          Entities
        </span>
        <span className="text-[12px] text-[var(--cg-color-link-text,#064c79)]">
          {entityCount} entity {entityCount === 1 ? "type" : "types"} · derived from /profile
        </span>
      </div>

      {/* Entity grid */}
      {entities.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No entities found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entities.map((entity) => (
            <EntityCardWithCount key={entity.name} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome header block
// ---------------------------------------------------------------------------

function WelcomeHeader() {
  return (
    <div className="mb-1.5 flex items-center gap-[18px]">
      <LogomarkColor size={48} />
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-foreground">
          Welcome to ContentGrid Navigator
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Interact with your ContentGrid application. Create, search and discover.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home divider — gradient bar separating welcome block from entity grid
// ---------------------------------------------------------------------------

function HomeDivider() {
  return (
    <div
      className="mb-[26px] mt-[22px] h-0.5 rounded-sm"
      style={{
        background:
          "linear-gradient(90deg, var(--cg-color-sky) 0%, var(--cg-color-breeze) 35%, var(--cg-color-line) 100%)",
      }}
    />
  );
}
