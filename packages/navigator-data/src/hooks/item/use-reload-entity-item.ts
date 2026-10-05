import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EntityItem } from "../../accessors/entity-item";
import { useNavigatorData } from "../context";

/**
 * Returns a function that GETs the latest version of `entityItem` (from its self link) into the
 * item cache and resolves with it — for re-applying changes after a 412. Rejects when the reload
 * fails, which also puts the cached item query into its error state.
 */
export function useReloadEntityItem(entityItem: EntityItem): () => Promise<EntityItem> {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.fetchQuery(
        EntityItem.fetchByUrlQuery(apiFetch, entityItem.selfLink.href, entityItem.profileEntity, {
          staleTime: 0,
          retry: false,
        }),
      ),
    [apiFetch, queryClient, entityItem],
  );
}
