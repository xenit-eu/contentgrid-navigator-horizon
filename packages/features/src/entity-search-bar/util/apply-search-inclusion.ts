import type { SearchParamDescriptor } from "./types";

/**
 * The parameters that take part in the selector, the suggestions and the quick filters
 * (FR-034–FR-036): inclusion is decided per attribute — excluding an attribute drops all of its
 * parameters — and relation parameters are always kept. Active-filter chips do NOT go through
 * this (FR-037).
 */
export function applySearchInclusion(
  descriptors: readonly SearchParamDescriptor[],
  isIncluded: (attributeName: string) => boolean,
): SearchParamDescriptor[] {
  return descriptors.filter((d) => d.relation !== undefined || isIncluded(d.groupKey));
}
