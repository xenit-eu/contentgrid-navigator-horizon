import type { SearchAttributeInclusion } from "../../preferences/use-search-attribute-inclusion";
import type { SearchParamDescriptor } from "./types";

/**
 * The parameters that take part in the selector, the suggestions and the quick filters
 * (FR-034–FR-036a): inclusion is decided per attribute — excluding an attribute drops all of its
 * parameters — and relation parameters are kept unless search is off: the entity has
 * attribute parameters and none of them is included. An entity without searchable attributes of
 * its own keeps its relation parameters. Active-filter chips do NOT go through this (FR-037).
 */
export function applySearchInclusion(
  descriptors: readonly SearchParamDescriptor[],
  includedAttributes: SearchAttributeInclusion["includedAttributes"],
): readonly SearchParamDescriptor[] {
  if (includedAttributes === "all") return descriptors;
  const isOwn = (d: SearchParamDescriptor) => d.relation === undefined;
  const searchOff =
    descriptors.some(isOwn) &&
    !descriptors.some((d) => isOwn(d) && includedAttributes.has(d.groupKey));
  if (searchOff) return [];
  return descriptors.filter((d) => !isOwn(d) || includedAttributes.has(d.groupKey));
}
