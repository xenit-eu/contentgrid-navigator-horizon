import type { QueryClient } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import ProfileEntity, { profileRootQuery } from "../accessors/entity-profile";
import { cgRels } from "../api";
import type { TypedFetch } from "../api/client";
import type { EntityCollectionParams } from "../hooks/collection/use-entity-item-collection";
import { resolveCollectionRequest } from "../hooks/collection/use-entity-item-collection";

/**
 * Ensure every entity profile is present in the query cache — the loader
 * equivalent of `useProfileEntities()`. Fetches the profile root once, then
 * every entity profile it links to, in parallel. Safe to call from multiple
 * route loaders concurrently: `ensureQueryData` dedupes identical in-flight
 * requests by query key, so calling this from a parent AND a child route's
 * loader for the same navigation costs one network round trip, not two.
 */
export async function ensureProfileEntities(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
): Promise<ProfileEntity[]> {
  const rootProfile = await queryClient.ensureQueryData(profileRootQuery(apiFetch, profileUrl));
  const entityLinks = rootProfile.links.findLinks(cgRels.entity);
  return Promise.all(
    entityLinks.map((link) =>
      queryClient.ensureQueryData(ProfileEntity.profileByLinkQuery(apiFetch, link)),
    ),
  );
}

/**
 * Ensure a single entity profile (by its singular `name`) is present in the
 * query cache — the loader equivalent of `useProfileEntity({ name })`.
 * Returns undefined if no profile with that name exists (e.g. a stale/invalid
 * `$entity` route param); callers should redirect or 404 in that case.
 */
export async function ensureProfileEntityByName(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  name: string,
): Promise<ProfileEntity | undefined> {
  const profiles = await ensureProfileEntities(queryClient, apiFetch, profileUrl);
  return profiles.find((profile) => profile.name === name);
}

/**
 * Ensure a collection page is present in the query cache — the loader
 * equivalent of `useEntityItemCollection(params)`. Returns undefined when the
 * query would be disabled (e.g. no search template and no explicit
 * searchValues) — nothing to prefetch in that case; the hook will reflect the
 * same disabled state on render.
 */
export async function ensureEntityItemCollection(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  params: EntityCollectionParams,
): Promise<EntityItemCollection | undefined> {
  const { url, enabled } = resolveCollectionRequest(params);
  if (!enabled) return undefined;
  return queryClient.ensureQueryData(
    EntityItemCollection.fetchByUrlQuery(apiFetch, url, params.profileEntity),
  );
}

/**
 * Ensure a single entity item is present in the query cache — the loader
 * equivalent of `useEntityItem({ profileEntity, entityId })` (known-profile
 * mode; loaders always know the profile via `ensureProfileEntityByName` first,
 * and a route's `$itemId` param is always a defined string once matched).
 */
export async function ensureEntityItem(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileEntity: ProfileEntity,
  entityId: string,
): Promise<EntityItem> {
  const url = profileEntity.itemUrl(entityId);
  return queryClient.ensureQueryData(EntityItem.fetchByUrlQuery(apiFetch, url, profileEntity));
}
