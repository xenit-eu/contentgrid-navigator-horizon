import { FilterButton } from "@contentgrid/ui";
import type { BooleanQuickFilter as BooleanQuickFilterModel } from "../util/build-quick-filters";
import { booleanValueIcon, searchTypeIcon } from "./search-icons";

export interface BooleanQuickFilterProps {
  readonly quickFilter: BooleanQuickFilterModel;
  readonly onCycle: (groupKey: string) => void;
  readonly onClear: (groupKey: string) => void;
}

/**
 * One-click quick filter for a boolean attribute (FR-028): each click moves unset → true →
 * false → unset. The outline is grey, green or red, and the button also shows the true / false
 * icon and names its state, so colour is never the only signal.
 */
export function BooleanQuickFilter({
  quickFilter,
  onCycle,
  onClear,
}: Readonly<BooleanQuickFilterProps>) {
  const { value } = quickFilter;
  const state = value === undefined ? "any" : value ? "true" : "false";
  return (
    <FilterButton
      icon={value === undefined ? searchTypeIcon("boolean", "exact") : booleanValueIcon(value)}
      label={
        value === undefined
          ? quickFilter.label
          : `${quickFilter.label}: ${value ? "True" : "False"}`
      }
      tone={quickFilter.tone}
      aria-label={`${quickFilter.label}: ${state}. Click to change.`}
      onClick={() => onCycle(quickFilter.groupKey)}
      onClear={() => onClear(quickFilter.groupKey)}
      clearLabel={`Clear ${quickFilter.label} filter`}
    />
  );
}
