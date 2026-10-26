import { type EntityItem, type ProfileEntity, useEntityItem } from "@contentgrid/navigator-data";
import { useProfileEntityTarget } from "./use-profile-entity-target";

/**
 * What an item view shows: either an entity name and the item's `id` field, or the item's own
 * link from the API. Both resolve to the same profile and the same cached item.
 */
export type EntityItemTarget =
  | {
      /** Profile entity name — never the plural path. */
      readonly entityName: string;
      /** The item's `id` field. */
      readonly itemId: string;
    }
  | {
      /** The item's own link (e.g. its `self` href); its profile is found through `describes`. */
      readonly itemUrl: string;
    };

/**
 * An {@link EntityItemTarget} resolved into loaded objects. `profileEntity` is known before the
 * item is, so a view can draw its toolbar while the item still loads or after it failed.
 */
export type EntityItemTargetResult =
  | { readonly status: "pending"; readonly profileEntity?: ProfileEntity }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly error: Error; readonly profileEntity: ProfileEntity }
  | {
      readonly status: "success";
      readonly profileEntity: ProfileEntity;
      readonly entityItem: EntityItem;
      /** Reloads the item; the view hands it to the feature's edit form for a version conflict. */
      readonly refetch: () => Promise<{ readonly data?: EntityItem; readonly isSuccess: boolean }>;
    };

/**
 * Resolves an {@link EntityItemTarget} into its `profileEntity` and `entityItem`, with the same
 * hook calls for both kinds of target. The profile is found by `useProfileEntityTarget`; the item
 * lands under `useEntityItem`'s own cache key, so the same item opened by name and by link is
 * loaded once.
 */
export function useEntityItemTarget(target: EntityItemTarget): EntityItemTargetResult {
  const byUrl = "itemUrl" in target;
  const profile = useProfileEntityTarget(byUrl ? { url: target.itemUrl } : target);
  const profileEntity = profile.status === "success" ? profile.profileEntity : undefined;

  const item = useEntityItem(
    byUrl ? { url: target.itemUrl } : { profileEntity, entityId: target.itemId },
  );

  if (profile.status !== "success") return profile;
  // A failed background refetch keeps the loaded item (and an open edit form) on screen.
  if (item.data) {
    return {
      status: "success",
      profileEntity: profile.profileEntity,
      entityItem: item.data,
      refetch: item.refetch,
    };
  }
  if (item.isError)
    return { status: "error", error: item.error, profileEntity: profile.profileEntity };
  return { status: "pending", profileEntity: profile.profileEntity };
}
