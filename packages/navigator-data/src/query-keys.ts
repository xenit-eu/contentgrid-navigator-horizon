import type { Link } from "@contentgrid/hal";
import type ProfileEntity from "./accessors/entity-profile";

const ENTITY_ITEM_KEY = "EntityItem";
const ENTITY_COLLECTION_KEY = "EntitySearch";
const ENTITY_PROFILE_KEY = "ProfileEntity";
const PROFILE_ROOT_KEY = "ProfileRoot";

/**
 * Centralized TanStack Query key factories for all navigator-data queries.
 *
 * Key hierarchy is designed for prefix-based invalidation:
 * - `entityItemCollection.all()` invalidates every collection query across all entity types.
 * - `entityItemCollection.forEntity(p)` is a prefix of both `byUrl` and `infiniteByUrl`
 *   → a single `invalidateQueries` call busts all paged and infinite-scroll queries for that entity.
 *
 * Usage in mutations:
 * ```typescript
 * queryClient.invalidateQueries({ queryKey: queryKeys.entityItemCollection.forEntity(profileEntity) });
 * ```
 */
export const queryKeys = {
  entityItem: {
    /** Prefix key — invalidates ALL cached entity items for one entity type. */
    forEntity: (profileEntity: ProfileEntity) => [ENTITY_ITEM_KEY, profileEntity.name] as const,
    /** Exact key for a single entity item by its self URL. */
    byUrl: (profileEntity: ProfileEntity, url: string) =>
      [ENTITY_ITEM_KEY, profileEntity.name, url] as const,
  },

  entityItemCollection: {
    /** Prefix key — invalidates ALL collection queries across all entity types. */
    all: () => [ENTITY_COLLECTION_KEY] as const,
    /** Prefix key — invalidates ALL paged and infinite-scroll collections for one entity type. */
    forEntity: (profileEntity: ProfileEntity) =>
      [ENTITY_COLLECTION_KEY, profileEntity.name] as const,
    /** Exact key for a single paged collection URL. */
    byUrl: (profileEntity: ProfileEntity, url: string) =>
      [ENTITY_COLLECTION_KEY, profileEntity.name, url] as const,
    /** Exact key for an infinite-scroll query starting at a URL. */
    infiniteByUrl: (profileEntity: ProfileEntity, url: string) =>
      [ENTITY_COLLECTION_KEY, profileEntity.name, "infinite", url] as const,
  },

  entityProfile: {
    /** Prefix key — invalidates ALL entity profiles. */
    all: () => [ENTITY_PROFILE_KEY] as const,
    /** Exact key for a specific profile link. */
    byLink: (link: Link) => [ENTITY_PROFILE_KEY, link.name, link.href] as const,
  },

  profileRoot: {
    /** Exact key for the profile root at a given URL. */
    byUrl: (profileUrl: string) => [PROFILE_ROOT_KEY, profileUrl] as const,
  },
};
