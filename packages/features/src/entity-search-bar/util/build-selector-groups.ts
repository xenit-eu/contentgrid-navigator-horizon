import { isSelectableParam } from "./select-param-chips";
import type { SearchParamDescriptor, SelectorMode } from "./types";

/** Selector option value of "All" mode. */
export const ALL_OPTION = "__all__";
/** Selector option value of "All except relations" mode. */
export const ALL_DIRECT_OPTION = "__all_direct__";

export interface SelectorOptionModel {
  /** `ALL_OPTION`, `ALL_DIRECT_OPTION`, or a parameter name. */
  readonly value: string;
  readonly label: string;
  /** Present for parameter options, to pick the type icon and hint. */
  readonly descriptor?: SearchParamDescriptor;
}

export interface SelectorGroupModel {
  /** `modes`, `self`, or a relation name. */
  readonly id: string;
  /** Header; absent for the leading modes group. */
  readonly label?: string;
  readonly options: readonly SelectorOptionModel[];
}

/**
 * The selector's options (data-model.md §3, FR-007, FR-009): "All" and "All except relations"
 * first, then the entity's own selectable parameters, then one group per relation (in profile
 * order), headed by the relation title. "All except relations" is only offered when the entity
 * has relation parameters to leave out.
 */
export function buildSelectorGroups(
  descriptors: readonly SearchParamDescriptor[],
  entityLabel: string,
): SelectorGroupModel[] {
  const selectable = descriptors.filter(isSelectableParam);
  const own = selectable.filter((d) => !d.relation);
  const byRelation = new Map<string, { title: string; options: SelectorOptionModel[] }>();
  for (const descriptor of selectable) {
    if (!descriptor.relation) continue;
    const group = byRelation.get(descriptor.relation.name) ?? {
      title: descriptor.relation.title,
      options: [],
    };
    group.options.push(toOption(descriptor));
    byRelation.set(descriptor.relation.name, group);
  }

  const modes: SelectorOptionModel[] = [{ value: ALL_OPTION, label: "All" }];
  if (byRelation.size > 0) modes.push({ value: ALL_DIRECT_OPTION, label: "All except relations" });

  const groups: SelectorGroupModel[] = [{ id: "modes", options: modes }];
  if (own.length > 0) groups.push({ id: "self", label: entityLabel, options: own.map(toOption) });
  for (const [name, { title, options }] of byRelation) {
    groups.push({ id: name, label: title, options });
  }
  return groups;
}

function toOption(descriptor: SearchParamDescriptor): SelectorOptionModel {
  return { value: descriptor.name, label: descriptor.attributeLabel, descriptor };
}

/** The option value of a selector mode. */
export function selectorValue(mode: SelectorMode): string {
  switch (mode.kind) {
    case "all":
      return ALL_OPTION;
    case "all-direct":
      return ALL_DIRECT_OPTION;
    case "param":
      return mode.name;
  }
}

/** The selector mode of an option value. */
export function selectorMode(value: string): SelectorMode {
  if (value === ALL_OPTION) return { kind: "all" };
  if (value === ALL_DIRECT_OPTION) return { kind: "all-direct" };
  return { kind: "param", name: value };
}
