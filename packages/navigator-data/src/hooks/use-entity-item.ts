import { type QueryClient, useQuery } from "@tanstack/react-query";
import { SimpleLink } from "@contentgrid/hal";
import type { EntityItem } from "../accessors/entity-item";
import { EntityItem as EntityItemClass } from "../accessors/entity-item";
import type ProfileEntity from "../accessors/entity-profile";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

export interface UseEntityItemOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItem, Error>>;
}

/**
 * Known profile: profile is supplied directly; item URL is expanded from the entity ID
 * using the profile's `itemLink` URI template.
 * Query is disabled when `entityId` is undefined.
 */
export interface EntityItemByProfile {
  profileEntity: ProfileEntity;
  entityId: string | undefined;
}

/**
 * Discover profile: only the full item URL is known.
 * The hook finds the matching profile by calling `profile.describes()` against
 * each loaded profile's describes links.
 * Query is disabled until the matching profile is available.
 */
export interface EntityItemDiscoverProfile {
  url: string;
}

export type UseEntityItemParams = EntityItemByProfile | EntityItemDiscoverProfile;

function isByProfile(params: UseEntityItemParams): params is EntityItemByProfile {
  return "profileEntity" in params;
}

/**
 * Fetches a single entity item.
 *
 * Two modes:
 * - **Known profile** `{ profileEntity, entityId }` — use when the profile is already loaded.
 *   The item URL is expanded from the profile's `itemLink` URI template.
 *   Query is disabled when `entityId` is undefined.
 * - **Discover profile** `{ url }` — use when only the full item URL is known.
 *   Matches the URL against each loaded profile's `describes()` links to find the right profile.
 *   Query is disabled until the matching profile is available.
 *
 * The ETag from the response is stored on the returned `EntityItem` (`item.etag`).
 * Pass it as `If-Match` on subsequent `editEntityRequest` calls (RFC 9110).
 *
 * @param params - Either `{ profileEntity, entityId }` or `{ url }`
 * @param options - Optional TanStack Query overrides
 */
export function useEntityItem(params: UseEntityItemParams, options?: UseEntityItemOptions) {
  const { apiFetch } = useNavigatorData();

  // Always load profiles — needed for discover mode; results are cached so no extra
  // network cost when called in known-profile mode.
  const profileResults = useProfileEntities();

  let url: string | undefined;
  let profileEntity: ProfileEntity | undefined;

  if (isByProfile(params)) {
    profileEntity = params.profileEntity;
    url = params.entityId == null ? undefined : profileEntity.itemUrl(params.entityId);
  } else {
    url = params.url;
    profileEntity = profileResults.find((r) => r.data?.describes(SimpleLink.to(url!)))?.data;
  }

  return useQuery({
    queryKey: profileEntity && url ? queryKeys.entityItem.byUrl(profileEntity, url) : [],
    queryFn: async () => {
      const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, new Request(url!));
      return new EntityItemClass(object, profileEntity!, etag);
    },
    enabled: !!url && !!profileEntity,
    ...options?.queryOptionsOverride,
  });
}

/**
 * Non-hook counterpart to `useEntityItem`'s known-profile mode, for use in
 * route `loader`s (which run before any component mounts, so hooks aren't
 * available). Mirrors `ensureProfileEntity` (`use-profile-entity.ts`).
 */
export async function ensureEntityItem(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileEntity: ProfileEntity,
  entityId: string,
): Promise<void> {
  const url = profileEntity.itemUrl(entityId);
  await queryClient.ensureQueryData(EntityItemClass.fetchByUrlQuery(apiFetch, url, profileEntity));
}
