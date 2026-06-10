import { Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import type { EntityInfo } from "@contentgrid/navigator-data";
import { useEntityCapabilities, useEntityList, useProfile } from "@contentgrid/navigator-data";
import { Skeleton } from "@contentgrid/ui";

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

  function handleCreateClick() {
    // TODO(HZN-5A): wire to create form when entity creation is implemented.
    // No-op until the create flow exists; the card itself is not clickable so
    // stopPropagation is unnecessary.
  }

  return (
    // Plain (non-interactive) tile — only the title Link below navigates.
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--cg-color-card-border)] bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          {/* The ONLY navigable element in the tile. */}
          <Link
            to="/$collection"
            params={{ collection: entity.name }}
            search={{ cursor: undefined, sort: undefined }}
            className="text-[13px] font-semibold text-foreground underline-offset-[3px] hover:text-primary hover:underline"
          >
            {entity.title}
          </Link>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {count !== undefined ? `${count.toLocaleString()} items` : "…"}
          </div>
        </div>

        {capabilities.canCreate && (
          <button
            type="button"
            title="Create"
            onClick={handleCreateClick}
            className="grid size-7 shrink-0 place-items-center rounded-md text-primary hover:bg-muted"
          >
            <PlusCircle className="size-[18px]" />
            <span className="sr-only">Create {entity.title}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------

function EntityCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--cg-color-card-border)] bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1.5">
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
        <div className="mb-[26px] mt-[22px] border-t border-border" />
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

      <div className="mb-[26px] mt-[22px] border-t border-border" />

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
      {/* CG circular logo glyph — ocean-outline chain mark on light background (per mockup) */}
      <div className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--cg-color-ocean,#084772)]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 6 L14 14 M18 14 L26 6 M6 26 L14 18 M18 18 L26 26 M14 14 L14 18 L18 18 L18 14 Z"
            stroke="var(--cg-color-ocean,#084772)"
            strokeWidth="2.2"
            strokeLinecap="square"
            fill="none"
          />
        </svg>
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
