import type { EnumOption } from "@contentgrid/ui";

/**
 * Implements User Story 4 / FR-019: instantly narrows a constrained (allowed-values) field's
 * own option list as the user types, entirely client-side — no server round trip, since the
 * field's `options` are already fully resolved (`HalFormsField`'s `kind: "enum"` variant,
 * inline options only per the spec's own Assumption; a remote/paginated options list falls
 * outside this behavior and is left to the existing multi-field Filters dialog).
 *
 * Pure, synchronous substring match against each option's `label` and `value` — a query of `""`
 * returns every option unchanged.
 */
export function filterEnumOptions(
  options: readonly EnumOption[],
  query: string,
): readonly EnumOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(normalized) ||
      option.value.toLowerCase().includes(normalized),
  );
}
