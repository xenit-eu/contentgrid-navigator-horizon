import { useState } from "react";
import {
  DateRangeFilter,
  type DateRangeFilterValue,
  FilterButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@contentgrid/ui";
import type { DateQuickFilter as DateQuickFilterModel } from "../util/build-quick-filters";
import {
  DATE_PRESETS,
  type DatePresetId,
  decodeDateRange,
  encodeDateRange,
  resolveDatePreset,
} from "../util/date-presets";
import { auditRoleIcon, searchTypeIcon } from "./search-icons";

export interface DateQuickFilterProps {
  readonly quickFilter: DateQuickFilterModel;
  readonly filters: Readonly<Record<string, string>>;
  readonly onApply: (groupKey: string, values: Record<string, string | undefined>) => void;
  readonly onClear: (groupKey: string) => void;
  /** Whether the popover is open — controlled, so a filter chip can open it too. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Quick filter for a date / datetime attribute, and for the created / modified audit dates
 * (FR-026, FR-027): a range calendar with presets. A preset is evaluated when Apply is clicked,
 * so "last week" always means the week before that moment.
 */
export function DateQuickFilter({
  quickFilter,
  filters,
  onApply,
  onClear,
  open,
  onOpenChange,
}: Readonly<DateQuickFilterProps>) {
  const [draft, setDraft] = useState<DateRangeFilterValue>({});
  const [presetId, setPresetId] = useState<DatePresetId | undefined>(undefined);

  // Each opening — from the button or from a chip — starts from the current filters.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(decodeDateRange(quickFilter, filters));
      setPresetId(undefined);
    }
  }

  const icon = quickFilter.auditRole
    ? auditRoleIcon(quickFilter.auditRole)
    : searchTypeIcon(quickFilter.includesTime ? "datetime" : "date", "gte");

  function apply() {
    const values = presetId
      ? encodeDateRange(resolveDatePreset(presetId, new Date()), quickFilter)
      : encodeDateRange(draft, quickFilter, { wholeDays: true });
    onApply(quickFilter.groupKey, values);
    onOpenChange(false);
  }

  function clear() {
    onClear(quickFilter.groupKey);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={icon}
          label={quickFilter.label}
          tone={quickFilter.tone}
          onClear={() => onClear(quickFilter.groupKey)}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DateRangeFilter
          value={draft}
          onValueChange={(value) => {
            setDraft(value);
            setPresetId(undefined);
          }}
          presets={DATE_PRESETS}
          activePresetId={presetId}
          onPresetSelect={(id) => {
            const preset = id as DatePresetId;
            setPresetId(preset);
            setDraft(resolveDatePreset(preset, new Date()));
          }}
          onApply={apply}
          onClear={clear}
        />
      </PopoverContent>
    </Popover>
  );
}
