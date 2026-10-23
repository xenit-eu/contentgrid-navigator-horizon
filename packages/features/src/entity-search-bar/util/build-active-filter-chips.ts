import { ProfileAttributeSearchType, type SearchRangeBound } from "@contentgrid/navigator-data";
import { shiftLocalDate } from "./date-presets";
import { type FormatOptions, formatFilterValue } from "./format-filter-value";
import { paramLabel } from "./param-labels";
import type { SearchParamDescriptor, SearchValueKind } from "./types";

export interface ActiveFilterChipModel {
  /** `range:<groupKey>` for a merged range, else the parameter name — unique per chip. */
  readonly id: string;
  /** Every `filters` key removing this chip clears. */
  readonly paramNames: readonly string[];
  readonly field: string;
  /** How the value matches: "starts with", "full text", "is", "between", "after", "≥", … */
  readonly mode: string;
  readonly value: string;
  readonly valueKind?: SearchValueKind;
  readonly searchType?: ProfileAttributeSearchType;
  /** Set for a boolean filter, so the chip can show the true / false icon. */
  readonly booleanValue?: boolean;
  /** The key is not a parameter of the current search form (e.g. a stale link). */
  readonly isUnresolved: boolean;
}

/**
 * One chip per active filter (data-model.md §6, FR-003, FR-004a, FR-037), whatever set it: the
 * bounds of one attribute's range merge into a single chip; any other parameter is its own chip;
 * a key the search form does not know still gets a chip, with its raw key and value, so the list
 * state is never hidden. Chips follow the form's parameter order, unknown keys last. `descriptors`
 * must be every parameter, before search-inclusion preferences are applied.
 */
export function buildActiveFilterChips(
  descriptors: readonly SearchParamDescriptor[],
  filters: Readonly<Record<string, string>>,
  formatOptions?: FormatOptions,
): ActiveFilterChipModel[] {
  const chips: ActiveFilterChipModel[] = [];
  const handledRanges = new Set<string>();
  const known = new Set(descriptors.map((d) => d.name));

  for (const descriptor of descriptors) {
    const raw = filters[descriptor.name];
    if (descriptor.bound) {
      if (handledRanges.has(descriptor.groupKey)) continue;
      handledRanges.add(descriptor.groupKey);
      const chip = rangeChip(descriptors, descriptor.groupKey, filters, formatOptions);
      if (chip) chips.push(chip);
      continue;
    }
    if (!raw) continue;
    chips.push({
      id: descriptor.name,
      paramNames: [descriptor.name],
      field: paramLabel(descriptor),
      mode: modeLabel(descriptor.searchType),
      value: formatFilterValue(descriptor, raw, formatOptions),
      valueKind: descriptor.valueKind,
      searchType: descriptor.searchType,
      booleanValue: descriptor.valueKind === "boolean" ? raw === "true" : undefined,
      isUnresolved: false,
    });
  }

  for (const [key, raw] of Object.entries(filters)) {
    if (!raw || known.has(key)) continue;
    chips.push({
      id: key,
      paramNames: [key],
      field: key,
      mode: "is",
      value: raw,
      isUnresolved: true,
    });
  }
  return chips;
}

function rangeChip(
  descriptors: readonly SearchParamDescriptor[],
  groupKey: string,
  filters: Readonly<Record<string, string>>,
  formatOptions: FormatOptions | undefined,
): ActiveFilterChipModel | undefined {
  const bounds = descriptors.filter((d) => d.groupKey === groupKey && d.bound && filters[d.name]);
  const lower = bounds.find((d) => d.bound?.side === "lower");
  const upper = bounds.find((d) => d.bound?.side === "upper");
  const first = lower ?? upper;
  if (!first) return undefined;

  const show = (d: SearchParamDescriptor, inclusive = false) => {
    const raw = filters[d.name]!;
    // "between" reads as the days included: for a date-only attribute an exclusive bound
    // (`~after` / `~before`, stored one day outside the picked range) is shown one day inwards.
    const shift =
      !inclusive || d.valueKind !== "date" || !d.bound || d.bound.inclusive
        ? 0
        : d.bound.side === "lower"
          ? 1
          : -1;
    return formatFilterValue(d, shift ? shiftLocalDate(raw, shift) : raw, formatOptions);
  };
  const isDate = first.valueKind === "date" || first.valueKind === "datetime";
  const mode = lower && upper ? "between" : boundLabel(first.bound!, isDate);
  const value = lower && upper ? `${show(lower, true)} – ${show(upper, true)}` : show(first);

  return {
    id: `range:${groupKey}`,
    paramNames: bounds.map((d) => d.name),
    field: paramLabel(first),
    mode,
    value,
    valueKind: first.valueKind,
    searchType: first.searchType,
    isUnresolved: false,
  };
}

function boundLabel(bound: SearchRangeBound, isDate: boolean): string {
  if (bound.side === "lower") {
    if (bound.inclusive) return isDate ? "from" : "≥";
    return isDate ? "after" : ">";
  }
  if (bound.inclusive) return isDate ? "until" : "≤";
  return isDate ? "before" : "<";
}

function modeLabel(searchType: ProfileAttributeSearchType): string {
  switch (searchType) {
    case ProfileAttributeSearchType.prefixMatch:
      return "starts with";
    case ProfileAttributeSearchType.fullText:
      return "full text";
    default:
      return "is";
  }
}
