import { type FormatOptions, formatFilterValue } from "./format-filter-value";
import { paramLabel } from "./param-labels";
import type { SearchMode, SearchParamDescriptor, SearchValueKind } from "./types";

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
  readonly searchMode?: SearchMode;
  /** Set for a boolean filter, so the chip can show the true / false icon. */
  readonly booleanValue?: boolean;
  /** The key is not a parameter of the current search form (e.g. a stale link). */
  readonly isUnresolved: boolean;
}

const LOWER: ReadonlySet<SearchMode> = new Set(["gt", "gte"]);
const UPPER: ReadonlySet<SearchMode> = new Set(["lt", "lte"]);

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
    const isBound = LOWER.has(descriptor.mode) || UPPER.has(descriptor.mode);

    if (isBound) {
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
      mode: modeLabel(descriptor.mode),
      value: formatFilterValue(descriptor, raw, formatOptions),
      valueKind: descriptor.valueKind,
      searchMode: descriptor.mode,
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
  const bounds = descriptors.filter(
    (d) => d.groupKey === groupKey && (LOWER.has(d.mode) || UPPER.has(d.mode)) && filters[d.name],
  );
  const lower = bounds.find((d) => LOWER.has(d.mode));
  const upper = bounds.find((d) => UPPER.has(d.mode));
  const first = lower ?? upper;
  if (!first) return undefined;

  const show = (d: SearchParamDescriptor) => formatFilterValue(d, filters[d.name]!, formatOptions);
  const isDate = first.valueKind === "date" || first.valueKind === "datetime";
  const mode = lower && upper ? "between" : boundLabel(first.mode, isDate);
  const value = lower && upper ? `${show(lower)} – ${show(upper)}` : show(first);

  return {
    id: `range:${groupKey}`,
    paramNames: bounds.map((d) => d.name),
    field: paramLabel(first),
    mode,
    value,
    valueKind: first.valueKind,
    searchMode: first.mode,
    isUnresolved: false,
  };
}

function boundLabel(mode: SearchMode, isDate: boolean): string {
  switch (mode) {
    case "gt":
      return isDate ? "after" : ">";
    case "gte":
      return isDate ? "from" : "≥";
    case "lt":
      return isDate ? "before" : "<";
    case "lte":
      return isDate ? "until" : "≤";
    default:
      return modeLabel(mode);
  }
}

function modeLabel(mode: SearchMode): string {
  switch (mode) {
    case "prefix":
      return "starts with";
    case "full-text":
      return "full text";
    default:
      return "is";
  }
}
