import * as React from "react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Calendar } from "../../primitives/calendar";
import { Label } from "../../primitives/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface DateTimeRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** A `Date`, or an ISO string (a date-only value, or an already-applied search filter value);
   * `""`/`undefined` for empty. */
  readonly value: Date | string | undefined;
  /** A `Date` when `includesTime`, else the raw `yyyy-MM-dd` string; `""` when cleared. */
  readonly onChange: (value: Date | string) => void;
  readonly error?: string;
  /** See `FieldShellProps.hideLabel`. */
  readonly hideLabel?: boolean;
  readonly includesTime: boolean;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves the field value to a `Date` in local time. A bare `yyyy-MM-dd` string is read as a
 * local calendar day (`new Date("2024-03-15")` would be UTC midnight and drift a day back in
 * timezones west of UTC); any other string is an ISO instant, e.g. an applied search filter.
 */
function toDate(value: Date | string | undefined): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** The browser-locale display format: "14 May 2026" / "15 May 2026, 09:12" (en-GB). */
function formatDisplay(date: Date, includesTime: boolean): string {
  return new Intl.DateTimeFormat(
    undefined,
    includesTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
  ).format(date);
}

export function DateTimeRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  hideLabel,
  includesTime,
  onFocus,
  onBlur,
}: Readonly<DateTimeRendererProps>) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const date = toDate(value);
  const timeValue = date ? format(date, "HH:mm") : "00:00";

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    if (includesTime) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      onChange(
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours ?? 0, minutes ?? 0),
      );
      return;
    }
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const pickTime = (raw: string) => {
    if (!date || raw === "") return;
    const [hours, minutes] = raw.split(":").map(Number);
    onChange(
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours ?? 0, minutes ?? 0),
    );
  };

  const placeholder = includesTime ? "dd mmm yyyy, hh:mm" : "dd mmm yyyy";

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
      hideLabel={hideLabel}
    >
      <Popover
        open={open && !readOnly}
        onOpenChange={(next) => {
          setOpen(next && !readOnly);
          if (!next) {
            // Focus normally returns to the trigger on close; if it went elsewhere (outside
            // click on another control), the field has really been left.
            requestAnimationFrame(() => {
              if (document.activeElement !== triggerRef.current) onBlur?.();
            });
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            id={name}
            name={name}
            type="button"
            // combobox (not button) so aria-readonly / aria-required are allowed (axe aria-allowed-attr).
            role="combobox"
            aria-readonly={readOnly || undefined}
            aria-required={required || undefined}
            onFocus={onFocus}
            // Focus moving into the open popover is not leaving the field.
            onBlur={() => {
              if (!open) onBlur?.();
            }}
            {...fieldAriaProps(name, error)}
            className={cn(
              "border-input dark:bg-input/30 flex h-9 w-fit max-w-full items-center gap-2 rounded-md border bg-transparent px-3 py-1 text-left text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
              includesTime ? "min-w-[210px]" : "min-w-[160px]",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              !date && "text-muted-foreground",
              readOnly && "cursor-default",
            )}
          >
            <CalendarBlankIcon size={16} aria-hidden className="shrink-0" />
            <span className="truncate">
              {date ? formatDisplay(date, includesTime) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(2100, 11)}
            selected={date}
            defaultMonth={date}
            onSelect={pickDay}
          />
          {includesTime && (
            <div className="flex items-center gap-2 border-t p-3">
              <Label htmlFor={`${name}-time`}>Time</Label>
              <input
                id={`${name}-time`}
                type="time"
                value={timeValue}
                disabled={!date}
                onChange={(event) => pickTime(event.target.value)}
                className="border-input h-8 rounded-md border bg-transparent px-2 text-sm dark:scheme-dark"
              />
            </div>
          )}
          {!required && date && (
            <div className="flex justify-end border-t p-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </FieldShell>
  );
}
