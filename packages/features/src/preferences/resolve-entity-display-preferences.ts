import {
  type EntityDisplayPreferences,
  type ProfileAttribute,
  type ProfileEntity,
  deepMerge,
} from "@contentgrid/navigator-data";

export interface ResolvedEntityDisplayPreferences {
  /** Fully merged preferences: user override > backend default > heuristic default. */
  readonly preferences: EntityDisplayPreferences;
  /** `preferences.nameAttribute` resolved against the profile, or `undefined` if unresolvable. */
  readonly nameAttribute: ProfileAttribute | undefined;
  /** `preferences.subtitleAttribute` resolved against the profile, or `undefined` if unresolvable. */
  readonly subtitleAttribute: ProfileAttribute | undefined;
}

/**
 * Pure merge of an entity's display-preference layers, highest priority first:
 * `override` (user) > `backendDefault` > `profileEntity.getDefaultPreferences()` (heuristic).
 *
 * This is the whole of `useEntityDisplayPreferences`' logic minus the store/query subscriptions,
 * so callers that need preferences for *many* entity types at once (e.g. the knowledge graph)
 * can resolve them in a loop without calling a hook per type.
 */
export function resolveEntityDisplayPreferences(
  profileEntity: ProfileEntity | undefined,
  override: Partial<EntityDisplayPreferences> | undefined,
  backendDefault: Partial<EntityDisplayPreferences> | undefined,
): ResolvedEntityDisplayPreferences {
  const heuristic = profileEntity?.getDefaultPreferences() ?? {};
  const preferences = deepMerge(
    deepMerge(heuristic as unknown as Record<string, unknown>, backendDefault ?? {}),
    override ?? {},
  ) as unknown as EntityDisplayPreferences;

  return {
    preferences,
    nameAttribute: preferences.nameAttribute
      ? profileEntity?.getAttribute(preferences.nameAttribute)
      : undefined,
    subtitleAttribute: preferences.subtitleAttribute
      ? profileEntity?.getAttribute(preferences.subtitleAttribute)
      : undefined,
  };
}
