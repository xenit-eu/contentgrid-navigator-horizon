import {
  type EntityDisplayPreferences,
  type ProfileAttribute,
  ProfileEntity,
  deepMerge,
  useEntityDisplayDefaults,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";

export interface UseEntityDisplayPreferencesResult {
  /** Fully merged preferences: user override > backend default > heuristic default. */
  readonly preferences: EntityDisplayPreferences;
  /** `preferences.nameAttribute` resolved against the profile, or `undefined` if unresolvable. */
  readonly nameAttribute: ProfileAttribute | undefined;
  /** Persist a partial override for this entity, scoped to the current backend. */
  readonly setOverride: (partial: Partial<EntityDisplayPreferences>) => void;
}

/**
 * The single entry point for reading (and writing) an entity's display preferences —
 * icon, color, cardStyle, nameAttribute, visibleColumns.
 *
 * Layers, highest priority first:
 * 1. User override (persisted, per-backend) — `entity-display-preferences-store.ts`.
 * 2. Backend automation default — `useEntityDisplayDefaults()` (currently stubbed to `{}`
 *    pending a backend contract; see that hook's doc comment).
 * 3. `profileEntity.getDefaultPreferences()` heuristic — always present, computed from the
 *    profile schema.
 *
 * `ProfileEntity` instances are rebuilt on every TanStack Query fetch rather than being a
 * long-lived singleton, so preferences are not stored as a property on the instance —
 * this hook recomputes the merge cheaply from the query cache + Zustand store on every call.
 *
 * Accepts `profileEntity: undefined` (e.g. a relation's target profile that hasn't resolved
 * yet) so callers can call this hook unconditionally, every render, per the Rules of Hooks —
 * never skip the call and branch on `profileEntity` beforehand. Preferences fall back to `{}`
 * (heuristic default only, no name attribute) until a real `ProfileEntity` is available.
 */
export function useEntityDisplayPreferences(
  profileEntity: ProfileEntity | undefined,
): UseEntityDisplayPreferencesResult {
  const { profileUrl } = useNavigatorData();
  const { data: backendDefaultsMap } = useEntityDisplayDefaults();
  const entityName = profileEntity?.name;
  const override = useEntityDisplayPreferencesStore((state) =>
    entityName ? state.overrides[profileUrl]?.[entityName] : undefined,
  );
  const setOverrideRaw = useEntityDisplayPreferencesStore((state) => state.setOverride);

  const heuristic = profileEntity?.getDefaultPreferences() ?? {};
  const backend = entityName ? backendDefaultsMap[entityName] : undefined;
  const preferences = deepMerge(
    deepMerge(heuristic as unknown as Record<string, unknown>, backend ?? {}),
    override ?? {},
  ) as unknown as EntityDisplayPreferences;

  return {
    preferences,
    nameAttribute: preferences.nameAttribute
      ? profileEntity?.getAttribute(preferences.nameAttribute)
      : undefined,
    setOverride: (partial) => {
      if (!entityName) return; // no resolved entity to scope this override to
      setOverrideRaw(profileUrl, entityName, partial);
    },
  };
}
