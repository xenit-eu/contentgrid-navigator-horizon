import type { SearchTermSuggestionCandidate } from "@contentgrid/navigator-data";

/**
 * Applies the FR-025/026 suggestion budget to a flat list of raw, unbudgeted candidates
 * (`useEntitySearchSuggestions`'s `searchTermSuggestions` — one entry per matching value per
 * contributing attribute, already internally deduplicated by `extractSuggestions`).
 *
 * Groups by `attributeGroupKey`, divides `totalCap` evenly across groups that have at least one
 * candidate, and — when a group has fewer candidates than its even share — redistributes that
 * group's unused share to groups with more candidates, without ever exceeding `totalCap` in
 * total (FR-025). A duplicate `value` within one group is deduplicated before counting against
 * that group's share (FR-026), on top of `extractSuggestions`'s own per-request dedup, in case
 * the SAME value is matched via more than one request for the same attribute.
 *
 * Pure and deterministic: canonicalizes group order (by `attributeGroupKey`) and each group's
 * candidate order (by `value`) before allocating, so the RESULT depends only on the candidate
 * set, never on the order `candidates` happened to arrive in.
 */
export function applySuggestionBudget(
  candidates: readonly SearchTermSuggestionCandidate[],
  totalCap = 20,
): readonly SearchTermSuggestionCandidate[] {
  const byGroup = new Map<string, SearchTermSuggestionCandidate[]>();
  for (const candidate of candidates) {
    const existing = byGroup.get(candidate.attributeGroupKey);
    if (!existing) {
      byGroup.set(candidate.attributeGroupKey, [candidate]);
    } else if (!existing.some((c) => c.value === candidate.value)) {
      existing.push(candidate);
    }
  }

  const groups = [...byGroup.keys()]
    .sort()
    .map((key) => [...byGroup.get(key)!].sort((a, b) => a.value.localeCompare(b.value)));

  const allocated: SearchTermSuggestionCandidate[] = [];
  const cursors = groups.map(() => 0);
  let remainingBudget = totalCap;

  // Round-robin one candidate per group per pass — this is what makes an exhausted group's
  // unused share fall through to the next pass for every OTHER group still with candidates left,
  // rather than a fixed per-group cap that would just leave budget unused.
  while (remainingBudget > 0) {
    let tookAny = false;
    for (let g = 0; g < groups.length && remainingBudget > 0; g++) {
      const cursor = cursors[g];
      const group = groups[g];
      if (cursor < group.length) {
        allocated.push(group[cursor]);
        cursors[g] = cursor + 1;
        remainingBudget--;
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }

  return allocated;
}
