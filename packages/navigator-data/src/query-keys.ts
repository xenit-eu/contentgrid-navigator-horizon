import type { Link } from "@contentgrid/hal";
import type ProfileEntity from "./accessors/entity-profile";

const ENTITY_ITEM_KEY = "EntityItem";
const ENTITY_COLLECTION_KEY = "EntitySearch";
const ENTITY_PROFILE_KEY = "ProfileEntity";
const PROFILE_ROOT_KEY = "ProfileRoot";
const ENTITY_DISPLAY_DEFAULTS_KEY = "EntityDisplayDefaults";
const TO_ONE_RELATION_KEY = "ToOneRelation";
const TO_MANY_RELATION_KEY = "ToManyRelation";
const TYPEAHEAD_SUGGESTIONS_KEY = "TypeaheadSuggestions";
const ENTITY_SEARCH_VALUE_SUGGESTIONS_KEY = "EntitySearchValueSuggestions";
const ENTITY_SEARCH_EFFECTIVE_MATCHES_KEY = "EntitySearchEffectiveMatches";
const COLLECTION_PAGE_KEY = "CollectionPage";
const COLLECTION_FILTERS_KEY = "CollectionFilters";
const COLLECTION_SORT_KEY = "CollectionSort";

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

  /**
   * Backend-provided display-preference defaults (icon/color/cardStyle/etc.), one batch fetch
   * per backend. Deliberately its own root — not nested under `profileRoot` — so invalidating
   * one doesn't invalidate the other. Not yet used by a live query: `useEntityDisplayDefaults`
   * is currently stubbed pending a backend contract (see hooks/preferences/).
   */
  entityDisplayDefaults: {
    /** Exact key for one backend's display-preference defaults, by profile URL. */
    byProfileUrl: (profileUrl: string) => [ENTITY_DISPLAY_DEFAULTS_KEY, profileUrl] as const,
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

  typeaheadSuggestions: {
    /**
     * Exact key for a single typeahead suggestions query (`useTypeahead`), by URL.
     *
     * Deliberately its OWN root — not nested under `entityItemCollection` — even though a
     * typeahead request and the table's own collection request can encode to the identical
     * URL (e.g. re-typing a value that's already committed for the same field). Sharing
     * `entityItemCollection.byUrl` in that case would put two `useQuery` observers with
     * different retry/staleTime/gcTime on one cache entry, where the last one to register
     * wins. A separate root makes that collision structurally impossible, regardless of
     * whether the two URLs ever happen to match.
     *
     * Trade-off: unlike collection queries, these are NOT covered by
     * `entityItemCollection.forEntity(...)` invalidation on create/update/delete mutations —
     * suggestions rely on their own short `staleTime` (see `useTypeahead`) to pick up changes
     * instead of being invalidated immediately.
     */
    byUrl: (profileEntity: ProfileEntity, url: string) =>
      [TYPEAHEAD_SUGGESTIONS_KEY, profileEntity.name, url] as const,
  },

  /**
   * `useEntitySearchSuggestions`'s per-attribute value-suggestion fan-out — same "own root, own
   * `byUrl`" rationale as `typeaheadSuggestions` (see its doc comment): a per-attribute probe
   * request can encode to the same URL as an unrelated `useTypeahead`/collection query, and
   * sharing a cache entry across differently-configured observers is what that root exists to
   * avoid. Kept separate from `typeaheadSuggestions` itself (rather than reused) so the two
   * hooks' queries never collide even when they happen to probe the exact same property/URL at
   * the same time (e.g. this search bar and the existing multi-field Filters dialog open at once).
   *
   * `propertyName` (the CURRENT entity's own property name, e.g. `"vendor.name~prefix"` — not
   * the relation-resolved target's local name) is part of the key, not just `url`: before a
   * relation-traversal property's target profile has resolved, its request is disabled and its
   * `url` is `""`, the same placeholder every other not-yet-resolved property also uses — without
   * `propertyName` discriminating them, every disabled query across every contributing property
   * would collide onto one identical key (TanStack Query's "Duplicate Queries" warning).
   */
  entitySearchValueSuggestions: {
    byUrl: (profileEntity: ProfileEntity, propertyName: string, url: string) =>
      [ENTITY_SEARCH_VALUE_SUGGESTIONS_KEY, profileEntity.name, propertyName, url] as const,
  },

  /**
   * `useEntitySearchSuggestions`'s per-attribute effective-match candidate fan-out. Its own root
   * for the same reason as `entitySearchValueSuggestions` above — these requests target the
   * CURRENT entity's own collection (research D2) and can easily encode to a URL identical to the
   * table's own `entityItemCollection` query or another attribute's probe. `propertyName` is part
   * of the key for the same disabled-query-collision reason documented there.
   */
  entitySearchEffectiveMatches: {
    byUrl: (profileEntity: ProfileEntity, propertyName: string, url: string) =>
      [ENTITY_SEARCH_EFFECTIVE_MATCHES_KEY, profileEntity.name, propertyName, url] as const,
  },

  collectionPage: {
    /** Exact key for the remembered current-page href of one entity's collection. */
    byEntityName: (entityName: string) => [COLLECTION_PAGE_KEY, entityName] as const,
  },

  collectionFilters: {
    /** Exact key for the remembered active filter values of one entity's collection. */
    byEntityName: (entityName: string) => [COLLECTION_FILTERS_KEY, entityName] as const,
  },

  collectionSort: {
    /** Exact key for the remembered active sort value of one entity's collection. */
    byEntityName: (entityName: string) => [COLLECTION_SORT_KEY, entityName] as const,
  },
};
