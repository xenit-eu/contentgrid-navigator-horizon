import type { Link } from "@contentgrid/hal";
import type ProfileEntity from "./accessors/entity-profile";

const ENTITY_ITEM_KEY = "EntityItem";
const ENTITY_COLLECTION_KEY = "EntitySearch";
const ENTITY_PROFILE_KEY = "ProfileEntity";
const PROFILE_ROOT_KEY = "ProfileRoot";
const TO_ONE_RELATION_KEY = "ToOneRelation";
const TO_MANY_RELATION_KEY = "ToManyRelation";
const TYPEAHEAD_KEY = "Typeahead";

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
    /**
     * Exact key for a single entity item by entity name string and URL.
     * Use when only the entity name is known (e.g. derived from a relation's target profile link)
     * and a full ProfileEntity is not available. Key shape is identical to `byUrl`.
     */
    byUrlForName: (entityName: string, url: string) => [ENTITY_ITEM_KEY, entityName, url] as const,
    /**
     * Prefix key — invalidates ALL cached entity items for one entity type by name string.
     * Use when only the entity name is known. Key shape is identical to `forEntity`.
     */
    forEntityName: (entityName: string) => [ENTITY_ITEM_KEY, entityName] as const,
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
      [ENTITY_COLLECTION_KEY, profileEntity.name, url, "infinite"] as const,
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

  toOneRelation: {
    /** Prefix key — invalidates ALL cached to-one relation queries for a given relation name. */
    forRelationName: (relationName: string) => [TO_ONE_RELATION_KEY, relationName] as const,
    /** Exact key for a specific to-one relation by relation name and relation URL. */
    byUrl: (relationName: string, relationUrl: string) =>
      [TO_ONE_RELATION_KEY, relationName, relationUrl] as const,
  },

  toManyRelation: {
    /** Prefix key — invalidates ALL cached to-many relation queries for a given relation name. */
    forRelationName: (relationName: string) => [TO_MANY_RELATION_KEY, relationName] as const,
    /** Exact key for a specific to-many relation by relation name and relation URL. */
    byUrl: (relationName: string, relationUrl: string) =>
      [TO_MANY_RELATION_KEY, relationName, relationUrl] as const,
  },

  typeahead: {
    /** Prefix key — invalidates ALL typeahead results for one entity. */
    forEntity: (entityName: string) => [TYPEAHEAD_KEY, entityName] as const,
    /** Exact key for a single typeahead query (entity × property × query string). */
    byProperty: (entityName: string, propertyName: string, query: string) =>
      [TYPEAHEAD_KEY, entityName, propertyName, query] as const,
  },
};
