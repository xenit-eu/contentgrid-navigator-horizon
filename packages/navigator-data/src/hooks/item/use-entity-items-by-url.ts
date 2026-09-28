import { useQueries, useQueryClient } from "@tanstack/react-query";
import { EntityItem } from "../../accessors/entity-item";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { QueryOptionsOverride } from "../../utils/query-options-override";
import { useNavigatorData } from "../context";
import { findCachedEntityItem } from "./use-entity-item";

export interface UseEntityItemsByUrlParams {
  readonly urls: readonly string[];
  readonly profileEntity: ProfileEntity;
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItem, Error>>;
}

export interface EntityItemsByUrlResult {
  /** The loaded items, in `urls` order, as an unpaginated collection. */
  readonly collection: EntityItemCollection;
  /** URLs whose item failed to load (e.g. deleted, or not readable by this user). */
  readonly failed: readonly { readonly url: string; readonly error: Error }[];
}

/**
 * Fetches several entity items by URL (e.g. a relation field's linked items) as one collection.
 * An item already present in a cached collection page is shown immediately as placeholder data.
 */
export function useEntityItemsByUrl({
  urls,
  profileEntity,
  queryOptionsOverride,
}: UseEntityItemsByUrlParams): EntityItemsByUrlResult {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  return useQueries({
    queries: urls.map((url) => ({
      ...EntityItem.fetchByUrlQuery(apiFetch, url, profileEntity, queryOptionsOverride),
      // Shown while the item's own GET runs: never written to the item's cache entry, which
      // must hold the fetched item with its ETag.
      placeholderData: () => findCachedEntityItem(queryClient, profileEntity, url),
    })),
    combine: (results) => ({
      collection: EntityItemCollection.fromItems(
        results.flatMap((result) => (result.data ? [result.data] : [])),
        profileEntity,
      ),
      failed: results.flatMap((result, index) =>
        result.isError ? [{ url: urls[index]!, error: result.error }] : [],
      ),
    }),
  });
}
