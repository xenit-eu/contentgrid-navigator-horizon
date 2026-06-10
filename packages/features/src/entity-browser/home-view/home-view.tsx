import { useRouter } from "@tanstack/react-router";
import type { EntityInfo } from "@contentgrid/navigator-data";
import { useEntityCapabilities, useEntityList, useProfile } from "@contentgrid/navigator-data";
import { EntityCard, Skeleton } from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// Per-entity child component — fetches count + capabilities without
// violating rules-of-hooks (no hooks inside .map())
// ---------------------------------------------------------------------------

interface EntityCardWithCountProps {
  entity: EntityInfo;
  onTitleClick: (entityName: string) => void;
}

function EntityCardWithCount({ entity, onTitleClick }: Readonly<EntityCardWithCountProps>) {
  const router = useRouter();
  const listResult = useEntityList(entity.name, { size: 1 });
  const capabilities = useEntityCapabilities(entity.name);

  const count = listResult.data?.totalItems;

  function handleTitleClick(name: string) {
    onTitleClick(name);
  }

  function handleCreateClick(name: string) {
    // TODO(HZN-5A): wire to create form when entity creation is implemented
    void router.navigate({
      to: "/$collection" as never,
      params: { collection: name } as never,
      search: { cursor: undefined, sort: undefined } as never,
    });
  }

  return (
    <EntityCard
      name={entity.name}
      title={entity.title}
      count={count}
      onTitleClick={handleTitleClick}
      onCreateClick={capabilities.canCreate ? handleCreateClick : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------

function EntityCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="mt-1 h-3 w-8" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeView
// ---------------------------------------------------------------------------

export function HomeView() {
  const router = useRouter();
  const profile = useProfile();

  function handleTitleClick(entityName: string) {
    void router.navigate({
      to: "/$collection" as never,
      params: { collection: entityName } as never,
      search: { cursor: undefined, sort: undefined } as never,
    });
  }

  // Loading state — show skeleton grid while profile is loading
  if (profile.isPending) {
    return (
      <div className="px-8 py-9">
        <WelcomeHeader />
        <div className="my-6 border-t border-border" />
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-[0.04em] text-foreground">
            Entities
          </span>
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      <div className="my-6 border-t border-border" />

      {/* Section header */}
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-[0.04em] text-foreground">
          Entities
        </span>
        <span className="text-[12px] text-[var(--cg-color-ocean,#064C79)]">
          {entityCount} entity {entityCount === 1 ? "type" : "types"} · derived from /profile
        </span>
      </div>

      {/* Entity grid */}
      {entities.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No entities found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entities.map((entity) => (
            <EntityCardWithCount
              key={entity.name}
              entity={entity}
              onTitleClick={handleTitleClick}
            />
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
    <div className="flex items-center gap-[18px]">
      {/* CG circular logo glyph — ocean border on light background (per mockup) */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--cg-color-ocean,#084772)]">
        <span className="text-[11px] font-bold leading-none tracking-tight text-[var(--cg-color-ocean,#084772)]">
          CG
        </span>
      </div>
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
