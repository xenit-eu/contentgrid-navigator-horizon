import type { EntityDisplayPreferencesMap } from "../../accessors/entity-display-preferences";

export interface UseEntityDisplayDefaultsResult {
  readonly data: EntityDisplayPreferencesMap;
}

/**
 * Backend-provided default display preferences (icon/color/cardStyle/etc.) per entity,
 * written by an external automation. This is the middle layer of
 * `useEntityDisplayPreferences` (packages/features/src/preferences), between the
 * `ProfileEntity.getDefaultPreferences()` heuristic and the user's own overrides.
 *
 * TODO(backend contract): no link relation or response shape has been defined for this
 * endpoint yet, so this hook is stubbed to always return `{}` (no backend defaults) rather
 * than blocking the rest of the preferences layer. Once the backend exposes a link off the
 * profile root (e.g. a `cg:entity-display-preferences`-style relation), replace the body
 * with a `useQuery` following the `profileRootQuery` pattern in `accessors/entity-profile.ts`
 * (staleTime 5min, gcTime 10min, no baked-in retry — leave retry to the QueryClient default),
 * keyed by `queryKeys.entityDisplayDefaults.byProfileUrl(profileUrl)`, and validate the
 * response through `validateEntityDisplayPreferencesMap` before returning it.
 */
export function useEntityDisplayDefaults(): UseEntityDisplayDefaultsResult {
  return { data: {} };
}
