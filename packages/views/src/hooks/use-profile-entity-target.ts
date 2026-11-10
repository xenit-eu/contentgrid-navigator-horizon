import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";

/**
 * Which entity a view is about: either its profile entity name, or a link from the API to one of
 * its resources (an item, or a collection page with or without a query string).
 */
export type ProfileEntityTarget =
  | {
      /** Profile entity name — never the plural path. */
      readonly entityName: string;
    }
  | {
      /** A link to one of the entity's resources; its profile is found through `describes`. */
      readonly url: string;
    };

export type ProfileEntityTargetResult =
  | { readonly status: "pending" }
  | { readonly status: "not-found" }
  | { readonly status: "success"; readonly profileEntity: ProfileEntity };

/**
 * Resolves a {@link ProfileEntityTarget} into its `profileEntity`. By name, the profile is the
 * loaded one with that name; by link, it is the loaded one whose `describes` links match — the
 * name is never read from the link. When every profile has loaded and none matches, the result
 * is `not-found` rather than pending forever.
 */
export function useProfileEntityTarget(target: ProfileEntityTarget): ProfileEntityTargetResult {
  const { profiles, isLoading } = useLoadedProfileEntities();

  const profileEntity =
    "url" in target
      ? profiles.find((profile) => profile.describesUrl(target.url))
      : profiles.find((profile) => profile.name === target.entityName);

  if (profileEntity) return { status: "success", profileEntity };
  return isLoading ? { status: "pending" } : { status: "not-found" };
}
