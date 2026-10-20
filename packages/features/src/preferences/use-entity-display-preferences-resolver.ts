import { useCallback } from "react";
import {
  type ProfileAttribute,
  type ProfileEntity,
  useEntityDisplayDefaults,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { resolveEntityDisplayPreferences } from "./resolve-entity-display-preferences";

/** The display facts a multi-entity view needs per entity type. */
export interface ResolvedEntityDisplay {
  /** User/backend colour (any CSS colour), or `undefined` for the default. */
  readonly color: string | undefined;
  /** Icon name (always set — the heuristic default provides one). */
  readonly icon: string;
  readonly nameAttribute: ProfileAttribute | undefined;
}

/**
 * Returns a function resolving display preferences for **any** entity type — for views that
 * show many entity types at once (the knowledge graph), where calling
 * `useEntityDisplayPreferences` once per type is impossible under the Rules of Hooks.
 *
 * Subscribes once to the current backend's overrides, so a preference change (e.g. a new colour
 * picked on the configuration page) re-renders the consumer with the new values.
 */
export function useEntityDisplayPreferencesResolver(): (
  profileEntity: ProfileEntity,
) => ResolvedEntityDisplay {
  const { profileUrl } = useNavigatorData();
  const { data: backendDefaultsMap } = useEntityDisplayDefaults();
  const overrides = useEntityDisplayPreferencesStore((state) => state.overrides[profileUrl]);

  return useCallback(
    (profileEntity: ProfileEntity) => {
      const { preferences, nameAttribute } = resolveEntityDisplayPreferences(
        profileEntity,
        overrides?.[profileEntity.name],
        backendDefaultsMap[profileEntity.name],
      );
      return {
        color: preferences.color,
        icon: preferences.icon ?? "Database",
        nameAttribute,
      };
    },
    [overrides, backendDefaultsMap],
  );
}
