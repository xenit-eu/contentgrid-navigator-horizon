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
}: Readonly<DateQuickFilterProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeFilterValue>({});
  const [presetId, setPresetId] = useState<DatePresetId | undefined>(undefined);

  const icon = quickFilter.auditRole
    ? auditRoleIcon(quickFilter.auditRole)
    : searchTypeIcon(quickFilter.includesTime ? "datetime" : "date", "gte");

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(decodeDateRange(quickFilter, filters));
      setPresetId(undefined);
    }
    setOpen(next);
  }

  function apply() {
    const values = presetId
      ? encodeDateRange(resolveDatePreset(presetId, new Date()), quickFilter)
      : encodeDateRange(draft, quickFilter, { wholeDays: true });
    onApply(quickFilter.groupKey, values);
    setOpen(false);
  }

  function clear() {
    onClear(quickFilter.groupKey);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
