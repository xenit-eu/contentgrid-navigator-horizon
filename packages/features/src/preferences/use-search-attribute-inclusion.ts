import { useMemo } from "react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface SearchAttributeInclusion {
  /** The included attribute names, or `"all"` when there is no list at all (no profile yet). */
  readonly includedAttributes: ReadonlySet<string> | "all";
  readonly isIncluded: (attributeName: string) => boolean;
}

/**
 * Which attributes take part in the entity search bar (spec 003, FR-034–FR-036a), resolved like
 * visible columns: user preference, then backend default, then the heuristic default
 * (`ProfileEntity.getDefaultPreferences()`, which lists every searchable attribute). The winning
 * list is taken as is, keeping just the names that are searchable attributes of the entity
 * (renamed or removed names, or `id`, are dropped); an empty result switches search off. The
 * configuration panel shows this same resolution. Only without a profile is there no list at all,
 * and then nothing is restricted.
 *
 * Accepts `profileEntity: undefined` — call it unconditionally, every render.
 */
export function useSearchAttributeInclusion(
  profileEntity: ProfileEntity | undefined,
): SearchAttributeInclusion {
  const { preferences } = useEntityDisplayPreferences(profileEntity);
  const searchAttributes = preferences.searchAttributes;
  return useMemo(() => {
    if (!searchAttributes) {
      return { includedAttributes: "all", isIncluded: () => true };
    }
    const searchable = new Set(
      (profileEntity?.searchableAttributes ?? []).map((attribute) => attribute.name),
    );
    const included = new Set(searchAttributes.filter((name) => searchable.has(name)));
    return { includedAttributes: included, isIncluded: (name) => included.has(name) };
  }, [searchAttributes, profileEntity]);
}
