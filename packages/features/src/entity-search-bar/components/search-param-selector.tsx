import { GroupedSelect } from "@contentgrid/ui";
import {
  type SelectorGroupModel,
  selectorMode,
  selectorValue,
} from "../util/build-selector-groups";
import { searchTypeLabel } from "../util/param-labels";
import type { SelectorMode } from "../util/types";
import { searchTypeIcon } from "./search-icons";

export interface SearchParamSelectorProps {
  readonly groups: readonly SelectorGroupModel[];
  readonly mode: SelectorMode;
  readonly onModeChange: (mode: SelectorMode) => void;
}

/** The first column of the main search bar: what the free-text input searches in (FR-006–FR-009). */
export function SearchParamSelector({
  groups,
  mode,
  onModeChange,
}: Readonly<SearchParamSelectorProps>) {
  return (
    <GroupedSelect
      triggerLabel="Search in"
      value={selectorValue(mode)}
      onValueChange={(value) => onModeChange(selectorMode(value))}
      className="shrink-0"
      compact="below-sm"
      groups={groups.map((group) => ({
        id: group.id,
        label: group.label,
        options: group.options.map((option) => ({
          value: option.value,
          label: option.label,
          hint: option.descriptor ? searchTypeLabel(option.descriptor) : undefined,
          icon: option.descriptor
            ? searchTypeIcon(option.descriptor.valueKind, option.descriptor.mode)
            : undefined,
        })),
      }))}
    />
  );
}
