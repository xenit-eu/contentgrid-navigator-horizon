import type { SearchParamDescriptor, SearchParamOption } from "./types";

export type QuickFilterTone = "idle" | "active" | "positive" | "negative";

interface QuickFilterBase {
  /** Attribute key; identifies the quick filter. */
  readonly groupKey: string;
  readonly label: string;
  /** Every `filters` key this quick filter sets or clears. */
  readonly paramNames: readonly string[];
  /** Whether any of `paramNames` has a value in `filters`, whatever set it (FR-025). */
  readonly isActive: boolean;
  readonly tone: QuickFilterTone;
}

/** Date / datetime range, including the created / modified audit dates (FR-026, FR-027). */
export interface DateQuickFilter extends QuickFilterBase {
  readonly kind: "date";
  readonly includesTime: boolean;
  readonly auditRole?: "created" | "modified";
  /** Parameter of the lower bound (`~from`/`~after`), when the template offers one. */
  readonly lower?: string;
  readonly lowerInclusive: boolean;
  /** Parameter of the upper bound (`~until`/`~before`), when the template offers one. */
  readonly upper?: string;
  readonly upperInclusive: boolean;
}

/** Integer / decimal: exact and/or range parameters, rendered through `hal-forms` (FR-029). */
export interface NumberQuickFilter extends QuickFilterBase {
  readonly kind: "number";
  readonly valueKind: "integer" | "decimal";
}

/** One-click tri-state boolean (FR-028). */
export interface BooleanQuickFilter extends QuickFilterBase {
  readonly kind: "boolean";
  readonly param: string;
  readonly value: boolean | undefined;
}

/** Searchable list of allowed values (FR-030). */
export interface AllowedValuesQuickFilter extends QuickFilterBase {
  readonly kind: "allowed-values";
  readonly param: string;
  readonly options: readonly SearchParamOption[];
  readonly value: string | undefined;
}

export type QuickFilterModel =
  | DateQuickFilter
  | NumberQuickFilter
  | BooleanQuickFilter
  | AllowedValuesQuickFilter;

/**
 * One quick filter per direct attribute whose search parameters fit a quick-filter type
 * (data-model.md §7), in profile order with the created / modified audit dates last.
 * Relation parameters never get a quick filter (they stay in the advanced filter dialog).
 *
 * The `switch` on `valueKind` below is the one place the search bar branches on the kind of a
 * resolved HAL-FORMS field. It is the deviation logged in the plan's Complexity Tracking
 * (specs/003-single-search-bar-entity-item-collection/plan.md): quick filters are compact
 * filter controls, not form fields; the number quick filter still renders through `hal-forms`.
 */
export function buildQuickFilters(
  descriptors: readonly SearchParamDescriptor[],
  filters: Readonly<Record<string, string>>,
): QuickFilterModel[] {
  const groups = new Map<string, SearchParamDescriptor[]>();
  for (const descriptor of descriptors) {
    if (descriptor.relation) continue;
    const group = groups.get(descriptor.groupKey);
    if (group) group.push(descriptor);
    else groups.set(descriptor.groupKey, [descriptor]);
  }

  const regular: QuickFilterModel[] = [];
  const audit: QuickFilterModel[] = [];
  for (const [groupKey, group] of groups) {
    const model = toQuickFilter(groupKey, group, filters);
    if (!model) continue;
    if (model.kind === "date" && model.auditRole) audit.push(model);
    else regular.push(model);
  }
  return [...regular, ...audit];
}

function toQuickFilter(
  groupKey: string,
  group: readonly SearchParamDescriptor[],
  filters: Readonly<Record<string, string>>,
): QuickFilterModel | undefined {
  const first = group[0]!;
  const label = first.attributeLabel;
  const has = (name: string) => !!filters[name];

  switch (first.valueKind) {
    case "date":
    case "datetime": {
      const lower = group.find((d) => d.mode === "gte" || d.mode === "gt");
      const upper = group.find((d) => d.mode === "lte" || d.mode === "lt");
      if (!lower && !upper) return undefined;
      const paramNames = [lower?.name, upper?.name].filter((n): n is string => !!n);
      const isActive = paramNames.some(has);
      return {
        kind: "date",
        groupKey,
        label,
        paramNames,
        isActive,
        tone: isActive ? "active" : "idle",
        includesTime: first.valueKind === "datetime",
        auditRole: first.auditRole,
        lower: lower?.name,
        lowerInclusive: lower?.mode === "gte",
        upper: upper?.name,
        upperInclusive: upper?.mode === "lte",
      };
    }
    case "integer":
    case "decimal": {
      const paramNames = group.map((d) => d.name);
      const isActive = paramNames.some(has);
      return {
        kind: "number",
        groupKey,
        label,
        paramNames,
        isActive,
        tone: isActive ? "active" : "idle",
        valueKind: first.valueKind,
      };
    }
    case "boolean": {
      const raw = filters[first.name];
      const value = raw === "true" ? true : raw === "false" ? false : undefined;
      return {
        kind: "boolean",
        groupKey,
        label,
        paramNames: [first.name],
        isActive: value !== undefined,
        tone: value === true ? "positive" : value === false ? "negative" : "idle",
        param: first.name,
        value,
      };
    }
    case "allowed-values": {
      const value = filters[first.name] || undefined;
      return {
        kind: "allowed-values",
        groupKey,
        label,
        paramNames: [first.name],
        isActive: value !== undefined,
        tone: value !== undefined ? "active" : "idle",
        param: first.name,
        options: first.options ?? [],
        value,
      };
    }
    case "text":
      return undefined;
    default: {
      const exhaustive: never = first.valueKind;
      return exhaustive;
    }
  }
}
