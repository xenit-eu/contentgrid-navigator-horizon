import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Calendar } from "../primitives/calendar";

export interface DateRangeFilterValue {
  readonly from?: Date;
  readonly to?: Date;
}

export interface DateRangeFilterProps {
  /** The draft range (controlled). */
  readonly value: DateRangeFilterValue;
  readonly onValueChange: (value: DateRangeFilterValue) => void;
  readonly presets: readonly { readonly id: string; readonly label: string }[];
  readonly activePresetId?: string;
  /** The caller resolves the preset into a range and sets `value`. */
  readonly onPresetSelect: (id: string) => void;
  readonly onApply: () => void;
  readonly onClear: () => void;
  /** Defaults to 1. */
  readonly numberOfMonths?: 1 | 2;
  readonly labels?: {
    readonly apply?: string;
    readonly clear?: string;
    readonly presets?: string;
  };
  readonly className?: string;
}

/**
 * A date range picker for filters: a range calendar on the left, quick presets on the right, and
 * Clear / Apply below. Stacks vertically on narrow screens. Works on plain dates — the caller
 * decides what a picked day means for its data (whole days, time zones, inclusive bounds).
 */
export function DateRangeFilter({
  value,
  onValueChange,
  presets,
  activePresetId,
  onPresetSelect,
  onApply,
  onClear,
  numberOfMonths = 1,
  labels,
  className,
}: Readonly<DateRangeFilterProps>) {
  return (
    <div data-slot="date-range-filter" className={cn("flex flex-col", className)}>
      <div className="flex flex-col sm:flex-row">
        <Calendar
          mode="range"
          numberOfMonths={numberOfMonths}
          selected={value.from || value.to ? { from: value.from, to: value.to } : undefined}
          defaultMonth={value.from ?? value.to}
          onSelect={(range) => onValueChange({ from: range?.from, to: range?.to })}
        />
        <div
          role="group"
          aria-label={labels?.presets ?? "Presets"}
          className="flex flex-row flex-wrap gap-1 border-t p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-t-0 sm:border-l"
        >
          {presets.map((preset) => {
            const active = preset.id === activePresetId;
            return (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={active ? "secondary" : "ghost"}
                aria-pressed={active}
                className="justify-start"
                onClick={() => onPresetSelect(preset.id)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t p-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          {labels?.clear ?? "Clear"}
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={!value.from && !value.to}>
          {labels?.apply ?? "Apply"}
        </Button>
      </div>
    </div>
  );
}
