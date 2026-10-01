import { useQueries } from "@tanstack/react-query";
import {
  EntityItem,
  type ProfileEntity,
  isProblemWithStatus,
  useLoadedProfileEntities,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import type { GraphItemLoad } from "../util/build-graph-model";
import { type GraphItemRef, graphNodeId } from "../util/graph-ids";

const isNoAccess = (error: unknown) =>
  isProblemWithStatus(error, 404) || isProblemWithStatus(error, 403);

export interface UseGraphItemsResult {
  readonly items: ReadonlyMap<string, GraphItemLoad>;
  /** Loaded profiles (for resolving entity titles and target profiles). */
  readonly profiles: readonly ProfileEntity[];
  /** Still waiting for the profile list itself. */
  readonly profilesLoading: boolean;
}

/**
 * Loads the items the graph fetches by identity rather than through a relation: the trail entries
 * and targets pinned from an overflow list. Each ref resolves its `ProfileEntity` by entity name
 * and its URL via `profileEntity.itemUrl(id)` (never string-built), and is cached under the same
 * `entityItem.byUrl` key as `useEntityItem` — so relation/item mutations that invalidate that key
 * refresh the graph too.
 *
 * A 403/404 marks the ref `unavailable` and is not retried (an ABAC outcome, not a failure).
 */
export function useGraphItems(refs: readonly GraphItemRef[]): UseGraphItemsResult {
  const { apiFetch } = useNavigatorData();
  const { profiles, isLoading: profilesLoading } = useLoadedProfileEntities();

  const unique = [...new Map(refs.map((ref) => [graphNodeId(ref), ref])).values()];
  const resolved = unique.map((ref) => ({
    ref,
    profile: profiles.find((p) => p.name === ref.entityName),
  }));

  const results = useQueries({
    queries: resolved.map(({ ref, profile }) =>
      profile
        ? EntityItem.fetchByUrlQuery(apiFetch, profile.itemUrl(ref.id), profile, {
            retry: (failureCount, error) => !isNoAccess(error) && failureCount < 3,
          })
        : {
            queryKey: ["EntityItem", ref.entityName, "__unresolved__", ref.id] as const,
            queryFn: () => Promise.resolve(undefined as unknown as EntityItem),
            enabled: false,
          },
    ),
  });

  const items = new Map<string, GraphItemLoad>();
  resolved.forEach(({ ref, profile }, i) => {
    const result = results[i]!;
    const unknownEntity = !profilesLoading && !profile;
    items.set(graphNodeId(ref), {
      item: result.data,
      status: unknownEntity ? "error" : result.status,
      unavailable: unknownEntity || (result.isError && isNoAccess(result.error)),
      error: result.error,
    });
  });

  return { items, profiles, profilesLoading };
}
