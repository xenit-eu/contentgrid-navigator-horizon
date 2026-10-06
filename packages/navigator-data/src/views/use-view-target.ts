import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type ProfileEntity from "../accessors/entity-profile";
import { useNavigatorData } from "../hooks/context";
import { viewTargetIdentityQuery } from "./resolve-view-target";
import type { ResolvedViewTarget, ViewTarget } from "./view-target";

export interface UseViewTargetResult {
  readonly data: ResolvedViewTarget | undefined;
  /**
   * The profile as soon as the target's identity is known, even while the item is still loading or
   * failed, so a view can keep drawing its toolbar around a loading or error state.
   */
  readonly profileEntity: ProfileEntity | undefined;
  readonly error: Error | null;
  readonly isPending: boolean;
  readonly isError: boolean;
  /** Refetches whichever part failed, or both. */
  readonly refetch: () => Promise<unknown>;
}

/**
 * Resolves a `ViewTarget` (a name or an API link) into loaded data, the same shape for both forms.
 *
 * Two queries: the target's identity (profile plus item or collection address), then, for an item
 * target, the item under `queryKeys.entityItem.byUrl` — so a name and a link for the same item share
 * one cache entry and one request, and item mutations reach the view. `ensureViewTarget` fills the
 * same keys for preloads.
 *
 * Errors: `ViewTargetNotFoundError`, `ViewTargetNotSupportedError` (narrow with
 * `isViewTargetNotFound` / `isViewTargetNotSupported`), or a problem-detail error from a request
 * (narrow with `isProblemWithStatus` and friends).
 */
export function useViewTarget(target: ViewTarget): UseViewTargetResult {
  const { apiFetch, profileUrl } = useNavigatorData();
  const queryClient = useQueryClient();

  const identityQuery = useQuery(
    viewTargetIdentityQuery(queryClient, apiFetch, profileUrl, target),
  );
  const identity = identityQuery.data;

  const itemOptions = identity?.itemUrl
    ? EntityItem.fetchByUrlQuery(apiFetch, identity.itemUrl, identity.profileEntity)
    : undefined;
  const itemQuery = useQuery<EntityItem, Error>({
    queryKey: [],
    ...itemOptions,
    enabled: !!itemOptions,
  });

  const data = useMemo<ResolvedViewTarget | undefined>(() => {
    if (!identity) return undefined;
    if (identity.itemUrl === undefined) {
      return { profileEntity: identity.profileEntity, collectionUrl: identity.collectionUrl };
    }
    return itemQuery.data
      ? { profileEntity: identity.profileEntity, entityItem: itemQuery.data }
      : undefined;
  }, [identity, itemQuery.data]);

  const error = identityQuery.error ?? itemQuery.error;
  return {
    data,
    profileEntity: identity?.profileEntity,
    error,
    isPending: identityQuery.isPending || (!!itemOptions && itemQuery.isPending),
    isError: error !== null,
    refetch: () =>
      Promise.all([
        identityQuery.isError ? identityQuery.refetch() : undefined,
        itemOptions ? itemQuery.refetch() : undefined,
      ]),
  };
}
