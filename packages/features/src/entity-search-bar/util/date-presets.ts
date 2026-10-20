import type { DateQuickFilter } from "./build-quick-filters";

export type DatePresetId = "last-day" | "last-week" | "last-month" | "last-year";

export const DATE_PRESETS: readonly { readonly id: DatePresetId; readonly label: string }[] = [
  { id: "last-day", label: "Last day" },
  { id: "last-week", label: "Last week" },
  { id: "last-month", label: "Last month" },
  { id: "last-year", label: "Last year" },
];

export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
}

type DateBounds = Pick<
  DateQuickFilter,
  "includesTime" | "lower" | "lowerInclusive" | "upper" | "upperInclusive" | "exact"
>;

/**
 * The range a preset stands for, ending `now` (data-model.md §8): the last 24 hours, 7 days,
 * calendar month or calendar year, in local time. A month or year back from a day the target
 * month does not have (31 March, 29 February) lands on that month's last day. Evaluated when the
 * filter is applied, not when the preset is highlighted.
 */
export function resolveDatePreset(id: DatePresetId, now: Date): Required<DateRange> {
  const from = new Date(now);
  switch (id) {
    case "last-day":
      from.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "last-week":
      from.setDate(now.getDate() - 7);
      break;
    case "last-month":
      return { from: addMonthsClamped(now, -1), to: new Date(now) };
    case "last-year":
      return { from: addMonthsClamped(now, -12), to: new Date(now) };
  }
  return { from, to: new Date(now) };
}

/**
 * Encodes a range as the values of a date quick filter's bound parameters, at the attribute's own
 * precision (FR-026), bounds included:
 * - date-only: `YYYY-MM-DD` (local); an exclusive bound (`~after` / `~before`) is moved one day
 *   outwards so the picked days stay inside the range;
 * - date-and-time: ISO timestamps; with `wholeDays` (a range picked on the calendar) the range
 *   runs from the start of its first day to the end of its last day.
 * A missing end leaves that parameter unset.
 */
export function encodeDateRange(
  range: DateRange,
  model: DateBounds,
  options: { readonly wholeDays?: boolean } = {},
): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  if (model.lower) {
    values[model.lower] = range.from
      ? model.includesTime
        ? (options.wholeDays ? startOfDay(range.from) : range.from).toISOString()
        : toLocalDate(model.lowerInclusive ? range.from : addDays(range.from, -1))
      : undefined;
  }
  if (model.upper) {
    values[model.upper] = range.to
      ? model.includesTime
        ? (options.wholeDays ? endOfDay(range.to) : range.to).toISOString()
        : toLocalDate(model.upperInclusive ? range.to : addDays(range.to, 1))
      : undefined;
  }
  return values;
}

/** The inverse of `encodeDateRange`, to show the current filter on the calendar. */
export function decodeDateRange(
  model: DateBounds,
  filters: Readonly<Record<string, string>>,
): DateRange {
  const read = (param: string | undefined, inclusive: boolean, outward: number) => {
    const raw = param ? filters[param] : undefined;
    if (!raw) return undefined;
    if (model.includesTime) {
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
    const date = fromLocalDate(raw);
    return date && !inclusive ? addDays(date, -outward) : date;
  };
  const from = read(model.lower, model.lowerInclusive, -1);
  const to = read(model.upper, model.upperInclusive, 1);
  if (!from && !to) {
    // Only an exact date is set (e.g. from the advanced dialog): show it as a one-day range.
    const day = read(model.exact, true, 0);
    if (day) return { from: day, to: day };
  }
  return { from, to };
}

/** A `YYYY-MM-DD` value moved by whole days, or the raw value when it is not a date. */
export function shiftLocalDate(raw: string, days: number): string {
  const date = fromLocalDate(raw);
  return date ? toLocalDate(addDays(date, days)) : raw;
}

function addMonthsClamped(date: Date, months: number): Date {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromLocalDate(raw: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
