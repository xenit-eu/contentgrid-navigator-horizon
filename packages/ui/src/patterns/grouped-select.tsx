import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";

export interface GroupedSelectOption {
  readonly value: string;
  readonly label: string;
  /** A short type indicator shown next to the label, e.g. "Starts with" or "Integer". */
  readonly hint?: string;
  readonly icon?: ReactNode;
}

export interface GroupedSelectGroup {
  readonly id: string;
  /** Group header; omit for a leading group without one. */
  readonly label?: string;
  readonly options: readonly GroupedSelectOption[];
}

export interface GroupedSelectProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly groups: readonly GroupedSelectGroup[];
  /** Accessible name of the trigger, e.g. "Search in". */
  readonly triggerLabel?: string;
  readonly size?: "sm" | "default";
  readonly className?: string;
  /**
   * Hide the selected option's label in the trigger (icon only): `true` always, `"below-sm"`
   * only on narrow screens.
   */
  readonly compact?: boolean | "below-sm";
}

/**
 * A single-select with grouped options, each with an icon and a type hint. The trigger shows the
 * selected option's icon, label and hint. Built on `Select`; knows nothing about what the
 * options stand for.
 */
export function GroupedSelect({
  value,
  onValueChange,
  groups,
  triggerLabel,
  size = "default",
  className,
  compact = false,
}: Readonly<GroupedSelectProps>) {
  const selected = groups.flatMap((group) => group.options).find((o) => o.value === value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size={size}
        aria-label={triggerLabel}
        className={cn("max-w-64 min-w-0", className)}
      >
        <SelectValue>
          {selected && (
            <span className="flex min-w-0 items-center gap-1.5">
              {selected.icon}
              <span
                className={cn(
                  "truncate",
                  compact === true && "sr-only",
                  compact === "below-sm" && "max-sm:sr-only",
                )}
              >
                {selected.label}
              </span>
              {selected.hint && compact !== true && (
                <span
                  className={cn(
                    "truncate text-xs text-muted-foreground",
                    compact === "below-sm" && "max-sm:hidden",
                  )}
                >
                  {selected.hint}
                </span>
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.map((group, index) => (
          <SelectGroup key={group.id}>
            {index > 0 && <SelectSeparator />}
            {group.label && <SelectLabel>{group.label}</SelectLabel>}
            {group.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.icon}
                <span>{option.label}</span>
                {option.hint && (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">{option.hint}</span>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
