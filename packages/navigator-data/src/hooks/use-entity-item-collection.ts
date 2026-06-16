import { queryOptions, useQuery } from "@tanstack/react-query";
import { HalObject, HalSlice } from "@contentgrid/hal";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import type ProfileEntity from "../accessors/entity-profile";
import type { TypedFetch } from "../api/client";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { useProfileEntity } from "./use-profile-entity";

/**
 * Fetch an entity collection using the ProfileEntity's search method.
 *
 * Calls the search template with empty search values to retrieve
 * the default collection, then wraps the response as an EntityItemCollection.
 *
 * @param apiFetch - Authenticated fetch function from navigator data context
 * @param profileEntity - Entity profile with search template
 * @returns EntityItemCollection instance with typed items
 */
export async function fetchEntityItemCollection(
  apiFetch: TypedFetch,
  profileEntity: ProfileEntity,
): Promise<EntityItemCollection> {
  if (!profileEntity.searchTemplate) {
    throw new Error(`Entity ${profileEntity.name} does not have a search template`);
  }

  // Create empty search values using the search template
  const searchValues = createValues(profileEntity.searchTemplate.template);

  // Use ProfileEntity's searchEntity method
  const response = await profileEntity.searchEntity(apiFetch, searchValues);

  // Parse the response as a HAL collection
  const json = await response.json();

  // TODO check why this is needed
  const halObject = new HalObject<EntityItemShape>(json as HalObjectShape<EntityItemShape>);
  const halSlice = HalSlice.from<EntityItemShape>(halObject);

  return new EntityItemCollection(halSlice, profileEntity);
}

/**
 * Query options factory for entity item collections.
 *
 * Use this to create queryOptions for prefetching or advanced query configuration.
 *
 * @example
 * ```typescript
 * const options = entityItemCollectionQuery(apiFetch, profileEntity);
 * queryClient.prefetchQuery(options);
 * ```
 */
export function entityItemCollectionQuery(apiFetch: TypedFetch, profileEntity: ProfileEntity) {
  return queryOptions({
    queryKey: queryKeys.entityList(profileEntity.name, {}),
    queryFn: () => fetchEntityItemCollection(apiFetch, profileEntity),
  });
}

/**
 * React hook to fetch and manage an entity collection.
 *
 * Fetches the default entity collection (no search/filter parameters) using the
 * ProfileEntity's search method and returns an EntityItemCollection with typed
 * access to items, pagination metadata, and navigation links.
 *
 * @param entityName - Name of the entity (singular form from profile)
 * @returns TanStack Query result with EntityItemCollection data
 *
 * @example
 * ```typescript
 * const { data: collection, isLoading } = useEntityItemCollection("invoice");
 *
 * if (collection) {
 *   collection.items.forEach(item => {
 *     console.log(item.userDefinedAttributes);
 *   });
 *
 *   if (collection.hasNext) {
 *     // Fetch next page using collection.nextHref
 *   }
 * }
 * ```
 */
export function useEntityItemCollection(entityName: string) {
  const { apiFetch } = useNavigatorData();
  const { data: profileEntity } = useProfileEntity({ name: entityName });

  return useQuery({
    queryKey: queryKeys.entityList(profileEntity?.name ?? entityName, {}),
    queryFn: () => {
      if (!profileEntity) {
        throw new Error(`Profile not loaded for entity: ${entityName}`);
      }
      return fetchEntityItemCollection(apiFetch, profileEntity);
    },
    enabled: !!entityName && !!profileEntity,
  });
}
