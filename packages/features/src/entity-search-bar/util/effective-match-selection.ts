import type { EntityItem } from "@contentgrid/navigator-data";
import { AttributeKind } from "@contentgrid/navigator-data";
import type { RecordTableSortOption } from "@contentgrid/ui";

function plainValue(item: EntityItem, propertyName: string): string | number | boolean | null {
  const attribute = item.findAttribute(propertyName)?.value;
  return attribute?.kind === AttributeKind.PLAIN ? attribute.value : null;
}

/** `null`/missing values sort last, regardless of direction — a record with no value for the
 * sort attribute shouldn't jump to the front just because "desc" reverses everything else. */
function compareValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * Implements FR-007/008/024/028: merges every contributing attribute's raw effective-match
 * candidates (`useEntitySearchSuggestions`'s `effectiveMatchCandidates` — already same-entity-type
 * per research D2, un-deduplicated and unordered across attributes), dedupes by `item.id` (the
 * same record can match via more than one attribute), orders by `currentSortOption` when one is
 * given — falling back to the candidates' own arrival order (the collection's server-returned
 * order for whichever single attribute contributed them) when there is none, never an ad-hoc
 * relevance score — and truncates to `cap`.
 */
export function selectEffectiveMatches(
  candidates: readonly EntityItem[],
  currentSortOption: RecordTableSortOption | undefined,
  cap = 5,
): readonly EntityItem[] {
  const deduped: EntityItem[] = [];
  const seenIds = new Set<string>();
  for (const item of candidates) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    deduped.push(item);
  }

  if (currentSortOption) {
    const { property, direction = "asc" } = currentSortOption;
    const sign = direction === "desc" ? -1 : 1;
    deduped.sort((a, b) => sign * compareValues(plainValue(a, property), plainValue(b, property)));
  }

  return deduped.slice(0, cap);
}
