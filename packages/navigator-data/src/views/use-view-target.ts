import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { useNavigatorData } from "../hooks/context";
import { queryKeys } from "../query-keys";
import { resolveViewTargetIdentity } from "./resolve-view-target";
import {
  type ResolvedViewTarget,
  type ViewTarget,
  isViewTargetNotFound,
  isViewTargetNotSupported,
} from "./view-target";

// Resolving the identity is stable for the session, like the profiles it reads.
const IDENTITY_STALE_TIME = 5 * 60 * 1000;

export interface UseViewTargetResult {
  readonly data: ResolvedViewTarget | undefined;
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

  const identityQuery = useQuery({
    queryKey: queryKeys.viewTarget.byTarget(target),
    queryFn: () => resolveViewTargetIdentity(queryClient, apiFetch, profileUrl, target),
    staleTime: IDENTITY_STALE_TIME,
    retry: (failureCount, error) => {
      // Name targets: resolveByName's nested queries (ensureProfileEntity -> profileByLinkQuery)
      // already retry themselves; retrying here too would just double the backoff.
      if (target.kind !== "url") return false;
      // Deterministic failures: no profile will appear, and no link will turn into an item or
      // collection, just by asking again — don't burn retries with backoff on them.
      if (isViewTargetNotFound(error) || isViewTargetNotSupported(error)) return false;
      // Otherwise a url target fetches the link directly with no query of its own underneath,
      // so give it the same retry: 3 policy as the other direct fetches (EntityItem.fetchByUrlQuery,
      // profileByLinkQuery).
      return failureCount < 3;
    },
  });
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
