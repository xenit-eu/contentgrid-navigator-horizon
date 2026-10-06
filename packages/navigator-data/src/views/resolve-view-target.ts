import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { HalSlice, SimpleLink } from "@contentgrid/hal";
import { ianaRelations } from "@contentgrid/hal/rels";
import { EntityItem } from "../accessors/entity-item";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import ProfileEntity, { profileRootQuery } from "../accessors/entity-profile";
import { cgRels } from "../api";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import { ensureProfileEntity } from "../hooks/profile/use-profile-entity";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import {
  type ResolvedViewTarget,
  type ViewTarget,
  ViewTargetNotFoundError,
  ViewTargetNotSupportedError,
} from "./view-target";

/**
 * The cheap half of a resolution: which profile, and which item or collection address. The item
 * itself is read through `EntityItem.fetchByUrlQuery`, so mutations that invalidate items reach
 * views too.
 */
export interface ViewTargetIdentity {
  readonly profileEntity: ProfileEntity;
  readonly itemUrl?: string;
  readonly collectionUrl?: string;
}

/**
 * Finds an item already in the cache under `url`, whichever profile loaded it. This is what lets a
 * link to an item opened earlier by name (or the other way round) cost no second request.
 */
function findCachedItemByUrl(queryClient: QueryClient, url: string): EntityItem | undefined {
  const entries = queryClient.getQueriesData<unknown>({ queryKey: ["EntityItem"] });
  for (const [key, data] of entries) {
    if (key[2] === url && data instanceof EntityItem) return data;
  }
  return undefined;
}

/** Loads every profile the root lists; one that fails to load is skipped, not fatal. */
async function loadAllProfiles(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
): Promise<ProfileEntity[]> {
  const root = await queryClient.ensureQueryData(profileRootQuery(apiFetch, profileUrl));
  const settled = await Promise.allSettled(
    root.links
      .findLinks(cgRels.entity)
      .map((link) =>
        queryClient.ensureQueryData(
          ProfileEntity.profileByLinkQuery(apiFetch, link, { retry: false }),
        ),
      ),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

async function resolveByName(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  target: Extract<ViewTarget, { kind: "name" }>,
): Promise<ViewTargetIdentity> {
  const profileEntity = await ensureProfileEntity(queryClient, apiFetch, profileUrl, {
    name: target.entityName,
  });
  if (!profileEntity) throw new ViewTargetNotFoundError(target);
  return target.itemId === undefined
    ? { profileEntity, collectionUrl: profileEntity.collectionUrl }
    : { profileEntity, itemUrl: profileEntity.itemUrl(target.itemId) };
}

async function resolveByUrl(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  target: Extract<ViewTarget, { kind: "url" }>,
): Promise<ViewTargetIdentity> {
  const { href } = target;

  const cachedItem = findCachedItemByUrl(queryClient, href);
  if (cachedItem) return { profileEntity: cachedItem.profileEntity, itemUrl: href };

  const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, new Request(href));

  // 1. The response's own profile link; 2. the profile whose `describes` links cover the resource.
  const profileLink =
    object.links.findLink(ianaRelations.profile) ?? object.links.findLink(cgRels.profile);
  const linkedProfile = profileLink
    ? await ensureProfileEntity(queryClient, apiFetch, profileUrl, { href: profileLink.href })
    : null;
  const profileEntity =
    linkedProfile ??
    (await loadAllProfiles(queryClient, apiFetch, profileUrl)).find((profile) =>
      profile.describes(SimpleLink.to(href)),
    );
  if (!profileEntity) throw new ViewTargetNotFoundError(target);

  const link = SimpleLink.to(href);
  // The response is already in hand: put it where the item and collection readers look.
  if (profileEntity.describesItem(link)) {
    queryClient.setQueryData(
      queryKeys.entityItem.byUrl(profileEntity, href),
      new EntityItem(object, profileEntity, etag),
    );
    return { profileEntity, itemUrl: href };
  }
  if (profileEntity.describesCollection(link)) {
    queryClient.setQueryData(
      queryKeys.entityItemCollection.byUrl(profileEntity, href),
      new EntityItemCollection(HalSlice.from<EntityItemShape>(object), profileEntity),
    );
    return { profileEntity, collectionUrl: href };
  }
  throw new ViewTargetNotSupportedError(href);
}

/**
 * Turns a `ViewTarget` into its profile and address. Rejects with `ViewTargetNotFoundError` (no
 * profile), `ViewTargetNotSupportedError` (a link that is not an item or collection), or the
 * problem-detail error of a failed request.
 */
export function resolveViewTargetIdentity(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  target: ViewTarget,
): Promise<ViewTargetIdentity> {
  return target.kind === "name"
    ? resolveByName(queryClient, apiFetch, profileUrl, target)
    : resolveByUrl(queryClient, apiFetch, profileUrl, target);
}

/**
 * Non-hook counterpart to `useViewTarget`, for route loaders and view preloads. Fills the cache
 * under the keys the hook reads: the profile, and for an item target the item.
 */
export async function ensureViewTarget(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  target: ViewTarget,
): Promise<ResolvedViewTarget> {
  const { profileEntity, itemUrl, collectionUrl } = await queryClient.ensureQueryData(
    viewTargetIdentityQuery(queryClient, apiFetch, profileUrl, target),
  );
  if (itemUrl === undefined) return { profileEntity, collectionUrl };
  const entityItem = await queryClient.ensureQueryData(
    EntityItem.fetchByUrlQuery(apiFetch, itemUrl, profileEntity, { retry: false }),
  );
  return { profileEntity, entityItem };
}

// The identity is stable for the session, like the profiles it reads.
const IDENTITY_STALE_TIME = 5 * 60 * 1000;

/**
 * Query options for a target's identity, shared by `useViewTarget` and `ensureViewTarget` so a
 * preload fills exactly what the hook reads.
 */
export function viewTargetIdentityQuery(
  queryClient: QueryClient,
  apiFetch: TypedFetch,
  profileUrl: string,
  target: ViewTarget,
) {
  return queryOptions({
    queryKey: queryKeys.viewTarget.byTarget(target),
    queryFn: () => resolveViewTargetIdentity(queryClient, apiFetch, profileUrl, target),
    staleTime: IDENTITY_STALE_TIME,
    // A missing profile will not appear by asking again; the profile queries retry themselves.
    retry: false,
  });
}
