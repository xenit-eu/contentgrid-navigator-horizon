import { useMemo } from "react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface SearchAttributeInclusion {
  /** The included attribute names, or `"all"` when no layer restricts them. */
  readonly includedAttributes: ReadonlySet<string> | "all";
  readonly isIncluded: (attributeName: string) => boolean;
}

/**
 * Which attributes take part in the entity search bar (spec 003, FR-034–FR-036), resolved like
 * visible columns: user preference, then backend default, then everything. Search parameters
 * over a relation are not governed by this — the search bar always includes them. A saved list
 * that names none of the entity's current attributes (all renamed or removed) falls back to
 * everything, so the search bar is never left with no attribute to search.
 *
 * Accepts `profileEntity: undefined` — call it unconditionally, every render.
 */
export function useSearchAttributeInclusion(
  profileEntity: ProfileEntity | undefined,
): SearchAttributeInclusion {
  const { preferences } = useEntityDisplayPreferences(profileEntity);
  const searchAttributes = preferences.searchAttributes;
  return useMemo(() => {
    const known = new Set(profileEntity?.attributes.map((attribute) => attribute.name));
    const resolves = searchAttributes?.some((name) => known.has(name));
    if (!searchAttributes || (profileEntity && !resolves)) {
      return { includedAttributes: "all", isIncluded: () => true };
    }
    const included = new Set(searchAttributes);
    return { includedAttributes: included, isIncluded: (name) => included.has(name) };
  }, [searchAttributes, profileEntity]);
}
