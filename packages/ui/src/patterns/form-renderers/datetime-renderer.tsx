import * as React from "react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Calendar } from "../../primitives/calendar";
import { inputClassName } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../../primitives/popover";
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

function formatOptions(includesTime: boolean): Intl.DateTimeFormatOptions {
  return includesTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
}

/** The browser-locale display format: "14 May 2026" / "15 May 2026, 09:12" (en-GB). */
function formatDisplay(date: Date, includesTime: boolean): string {
  return new Intl.DateTimeFormat(undefined, formatOptions(includesTime)).format(date);
}

const SAMPLE_DATE = new Date(2026, 4, 14, 9, 12);

/**
 * Placeholder in the same shape as `formatDisplay`, derived from the same formatter so it follows
 * the browser locale: en-GB "dd mmm yyyy, hh:mm", en-US "mmm dd, yyyy, hh:mm am/pm".
 */
export function formatPlaceholder(includesTime: boolean, locale?: string): string {
  return new Intl.DateTimeFormat(locale, formatOptions(includesTime))
    .formatToParts(SAMPLE_DATE)
    .map((part) => {
      switch (part.type) {
        case "day":
          return "dd";
        case "month":
          return /^\d+$/.test(part.value) ? "mm" : "mmm";
        case "year":
          return "yyyy";
        case "hour":
          return "hh";
        case "minute":
          return "mm";
        case "dayPeriod":
          return "am/pm";
        case "literal":
          return part.value.replaceAll(/\s/g, " ");
        default:
          return part.value;
      }
    })
    .join("");
}

const NBSP_LIKE = /[\u00a0\u202f]/g;
const TIME_SUFFIX = /[\s,]+(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i;
const ISO_DATE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const DATE_SEPARATORS = /[\s/.,-]+/;
const DIGITS = /^\d+$/;

function monthNames(locale: string | undefined): Map<string, number> {
  const names = new Map<string, number>();
  const add = (name: string, month: number) => {
    names.set(name.toLowerCase().replace(/\.+$/, ""), month);
  };
  for (let month = 0; month < 12; month++) {
    const sample = new Date(2000, month, 1);
    for (const tag of [locale, "en"]) {
      for (const style of ["long", "short"] as const) {
        add(new Intl.DateTimeFormat(tag, { month: style }).format(sample), month);
      }
    }
  }
  return names;
}

type DatePart = "day" | "month" | "year";

/** The locale's numeric day/month/year order: en-GB d/m/y, en-US m/d/y, ja y/m/d. */
function numericOrder(locale: string | undefined): DatePart[] {
  const order = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .formatToParts(new Date(2000, 10, 22))
    .map((part) => part.type)
    .filter((type): type is DatePart => type === "day" || type === "month" || type === "year");
  return order.length === 3 ? order : ["day", "month", "year"];
}

interface ParsedDate {
  readonly date: Date;
  readonly hasTime: boolean;
}

function dayMonthYear(
  tokens: string[],
  locale: string | undefined,
): { day: number; month: number; year: number } | undefined {
  if (tokens.length !== 3) return undefined;
  const months = monthNames(locale);
  const nameIndex = tokens.findIndex((token) =>
    months.has(token.toLowerCase().replace(/\.+$/, "")),
  );
  if (nameIndex >= 0) {
    const month = months.get(tokens[nameIndex]!.toLowerCase().replace(/\.+$/, ""))! + 1;
    const rest = tokens.filter((_, index) => index !== nameIndex);
    if (!rest.every((token) => DIGITS.test(token))) return undefined;
    const years = rest.filter((token) => token.length === 4);
    const days = rest.filter((token) => token.length <= 2);
    if (years.length !== 1 || days.length !== 1) return undefined;
    return { day: Number(days[0]), month, year: Number(years[0]) };
  }
  if (!tokens.every((token) => DIGITS.test(token))) return undefined;
  const result: Record<DatePart, string> = { day: "", month: "", year: "" };
  numericOrder(locale).forEach((part, index) => {
    result[part] = tokens[index]!;
  });
  if (result.year.length !== 4 || result.day.length > 2 || result.month.length > 2) {
    return undefined;
  }
  return { day: Number(result.day), month: Number(result.month), year: Number(result.year) };
}

function parseDateParts(
  text: string,
  includesTime: boolean,
  locale: string | undefined,
): ParsedDate | undefined {
  let rest = text.replace(NBSP_LIKE, " ").replaceAll(/\s+/g, " ").trim();
  let hours = 0;
  let minutes = 0;
  let hasTime = false;
  const time = TIME_SUFFIX.exec(rest);
  if (time) {
    if (!includesTime) return undefined;
    hasTime = true;
    hours = Number(time[1]);
    minutes = Number(time[2]);
    const meridiem = time[3]?.toLowerCase();
    if (meridiem) {
      if (hours < 1 || hours > 12) return undefined;
      hours = (hours % 12) + (meridiem === "p" ? 12 : 0);
    }
    if (hours > 23 || minutes > 59) return undefined;
    rest = rest.slice(0, time.index);
  }
  const iso = ISO_DATE.exec(rest);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : dayMonthYear(
        rest.split(DATE_SEPARATORS).filter((token) => token !== ""),
        locale,
      );
  if (!parts || parts.year < 1000 || parts.year > 9999) return undefined;
  const date = new Date(parts.year, parts.month - 1, parts.day, hours, minutes);
  const exists =
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day;
  return exists ? { date, hasTime } : undefined;
}

/**
 * Parses typed text into a local `Date`: ISO `yyyy-mm-dd`, the locale's numeric order
 * (en-GB `14/02/1996`, en-US `02/14/1996`) or a month name (`14 Feb 1996`, `Feb 14, 1996`),
 * with an optional `H:mm` / `h:mm pm` time when `includesTime`. Two-digit years are rejected as
 * ambiguous. Returns `undefined` for text that is not a real calendar date.
 */
export function parseDateInput(
  text: string,
  includesTime: boolean,
  locale?: string,
): Date | undefined {
  return parseDateParts(text, includesTime, locale)?.date;
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
  const [draft, setDraft] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | undefined>();
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const date = toDate(value);
  const timeValue = date ? format(date, "HH:mm") : "00:00";

  const resetDraft = () => {
    setDraft(null);
    setLocalError(undefined);
  };

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    resetDraft();
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
    resetDraft();
    const [hours, minutes] = raw.split(":").map(Number);
    onChange(
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours ?? 0, minutes ?? 0),
    );
  };

  /** Applies the typed text; keeps the draft and shows an error when it is not a date. */
  const commit = () => {
    if (draft === null) return;
    if (draft.trim() === "") {
      resetDraft();
      onChange("");
      return;
    }
    const parsed = parseDateParts(draft, includesTime, undefined);
    if (!parsed) {
      setLocalError(`Enter a date like ${formatDisplay(SAMPLE_DATE, includesTime)}`);
      return;
    }
    resetDraft();
    if (includesTime) {
      const { date: day, hasTime } = parsed;
      onChange(
        hasTime
          ? day
          : new Date(
              day.getFullYear(),
              day.getMonth(),
              day.getDate(),
              date?.getHours() ?? 0,
              date?.getMinutes() ?? 0,
            ),
      );
      return;
    }
    onChange(format(parsed.date, "yyyy-MM-dd"));
  };

  const placeholder = React.useMemo(() => formatPlaceholder(includesTime), [includesTime]);
  const inputText = draft ?? (date ? formatDisplay(date, includesTime) : "");
  const inField = (node: EventTarget | null) =>
    node instanceof Node &&
    (wrapperRef.current?.contains(node) || contentRef.current?.contains(node));

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error ?? localError}
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
              if (!wrapperRef.current?.contains(document.activeElement)) onBlur?.();
            });
          }
        }}
      >
        <PopoverAnchor asChild>
          <div
            ref={wrapperRef}
            onFocus={(event) => {
              if (!inField(event.relatedTarget)) onFocus?.();
            }}
            // Focus moving into the open popover (or between the field's own controls) is not
            // leaving the field.
            onBlur={(event) => {
              if (open || inField(event.relatedTarget)) return;
              onBlur?.();
            }}
            className={cn(
              inputClassName,
              "flex w-fit max-w-full items-center gap-2",
              "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
              "has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20 dark:has-[[aria-invalid=true]]:ring-destructive/40",
              includesTime ? "min-w-[210px]" : "min-w-[160px]",
              readOnly && "cursor-default",
            )}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Choose date"
                disabled={readOnly}
                className="-mx-0.5 size-5 text-current"
              >
                <CalendarBlankIcon size={16} aria-hidden className="size-4" />
              </Button>
            </PopoverTrigger>
            <input
              id={name}
              name={name}
              type="text"
              autoComplete="off"
              placeholder={placeholder}
              readOnly={readOnly}
              aria-required={required || undefined}
              value={inputText}
              // Content-based width, so the field sizes to its text like before (`w-fit` wrapper); `size`
              // counts average-width characters, so add 10% for proportional fonts.
              size={Math.ceil(Math.max(placeholder.length, inputText.length, 1) * 1.1)}
              onChange={(event) => {
                setDraft(event.target.value);
                setLocalError(undefined);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draft !== null) {
                  event.preventDefault();
                  commit();
                } else if (event.key === "Escape" && (draft !== null || localError)) {
                  event.preventDefault();
                  event.stopPropagation();
                  resetDraft();
                }
              }}
              {...fieldAriaProps(name, error ?? localError)}
              className="placeholder:text-muted-foreground min-w-0 flex-none bg-transparent outline-none read-only:cursor-default"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent ref={contentRef} align="start" className="w-auto p-0">
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
                  resetDraft();
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
