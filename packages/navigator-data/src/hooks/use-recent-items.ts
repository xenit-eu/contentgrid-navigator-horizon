import { createValues } from "@contentgrid/hal-forms/values";
import type ProfileEntity from "../accessors/entity-profile";
import { useEntityItemCollection } from "./use-entity-item-collection";
import type { UseEntityItemCollectionOptions } from "./use-entity-item-collection";

/**
 * Fetches the most recently created items for an entity, sorted by created-date descending.
 *
 * Returns a disabled query (no fetch) when the entity has no created-at audit attribute
 * or no matching descending sort option on its search template.
 *
 * @param profileEntity - Entity profile to fetch items for
 * @param options - Optional TanStack Query overrides (staleTime, gcTime, etc.)
 */
export function useRecentlyCreated(
  profileEntity: ProfileEntity,
  options?: UseEntityItemCollectionOptions,
) {
  const searchTemplate = profileEntity.searchTemplate;

  const searchValues = (() => {
    if (!searchTemplate || !profileEntity.createdAtAttribute || !searchTemplate.sortProperty) {
      return undefined;
    }
    const sortOption = searchTemplate.sortOptions?.find(
      (opt) => opt.profileAttribute?.isCreatedDate && opt.direction === "desc",
    );
    if (!sortOption) {
      return undefined;
    }
    return createValues(searchTemplate.template).withValue(searchTemplate.sortProperty.name, [
      sortOption.value,
    ]);
  })();

  return useEntityItemCollection({ profileEntity, searchValues }, options);
}

/**
 * Fetches the most recently modified items for an entity, sorted by modified-date descending.
 *
 * Returns a disabled query (no fetch) when the entity has no modified-at audit attribute
 * or no matching descending sort option on its search template.
 *
 * @param profileEntity - Entity profile to fetch items for
 * @param options - Optional TanStack Query overrides (staleTime, gcTime, etc.)
 */
export function useRecentlyModified(
  profileEntity: ProfileEntity,
  options?: UseEntityItemCollectionOptions,
) {
  const searchTemplate = profileEntity.searchTemplate;

  const searchValues = (() => {
    if (!searchTemplate || !profileEntity.modifiedAtAttribute || !searchTemplate.sortProperty) {
      return undefined;
    }
    const sortOption = searchTemplate.sortOptions?.find(
      (opt) => opt.profileAttribute?.isModifiedDate && opt.direction === "desc",
    );
    if (!sortOption) {
      return undefined;
    }
    return createValues(searchTemplate.template).withValue(searchTemplate.sortProperty.name, [
      sortOption.value,
    ]);
  })();

  return useEntityItemCollection({ profileEntity, searchValues }, options);
}
