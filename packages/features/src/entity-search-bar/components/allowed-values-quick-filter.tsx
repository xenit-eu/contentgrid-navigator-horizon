import {
  FilterButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableOptionList,
} from "@contentgrid/ui";
import type { AllowedValuesQuickFilter as AllowedValuesQuickFilterModel } from "../util/build-quick-filters";
import { searchTypeIcon } from "./search-icons";

export interface AllowedValuesQuickFilterProps {
  readonly quickFilter: AllowedValuesQuickFilterModel;
  readonly onApply: (groupKey: string, values: Record<string, string | undefined>) => void;
  readonly onClear: (groupKey: string) => void;
  /** Whether the popover is open — controlled, so a filter chip can open it too. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Quick filter for an attribute with a fixed list of allowed values (FR-030): a search field
 * above the list, narrowing it on the client the same way the main bar's allowed-value
 * suggestions are narrowed. Picking a value applies it.
 */
export function AllowedValuesQuickFilter({
  quickFilter,
  onApply,
  onClear,
  open,
  onOpenChange,
}: Readonly<AllowedValuesQuickFilterProps>) {
  const selected = quickFilter.options.find((o) => o.value === quickFilter.value);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={searchTypeIcon("allowed-values")}
          label={selected ? `${quickFilter.label}: ${selected.label}` : quickFilter.label}
          tone={quickFilter.tone}
          onClear={() => onClear(quickFilter.groupKey)}
          clearLabel={`Clear ${quickFilter.label} filter`}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <SearchableOptionList
          autoFocus
          label={quickFilter.label}
          options={quickFilter.options}
          value={quickFilter.value}
          onValueChange={(value) => {
            onApply(quickFilter.groupKey, { [quickFilter.param]: value });
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
