import type { SearchParamDescriptor } from "./types";

export interface FormatOptions {
  /** Defaults to the runtime's locale. */
  readonly locale?: string;
  /** Time zone for datetime values; defaults to the runtime's (the user's local time). */
  readonly timeZone?: string;
}

/**
 * A filter's raw URL value as a chip shows it: dates and datetimes per locale, numbers with
 * locale grouping, booleans as True / False, allowed values by their option label. A value that
 * cannot be read is shown as is.
 */
export function formatFilterValue(
  descriptor: SearchParamDescriptor,
  raw: string,
  options: FormatOptions = {},
): string {
  switch (descriptor.valueKind) {
    case "date": {
      // A date has no time zone: read and print it in UTC so it never shifts by a day.
      const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
      return Number.isNaN(date.getTime())
        ? raw
        : new Intl.DateTimeFormat(options.locale, { dateStyle: "medium", timeZone: "UTC" }).format(
            date,
          );
    }
    case "datetime": {
      const date = new Date(raw);
      return Number.isNaN(date.getTime())
        ? raw
        : new Intl.DateTimeFormat(options.locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: options.timeZone,
          }).format(date);
    }
    case "integer":
    case "decimal": {
      const number = Number(raw);
      return raw.trim() !== "" && Number.isFinite(number)
        ? new Intl.NumberFormat(options.locale, { maximumFractionDigits: 20 }).format(number)
        : raw;
    }
    case "boolean":
      if (raw === "true") return "True";
      if (raw === "false") return "False";
      return raw;
    case "allowed-values":
      return descriptor.options?.find((option) => option.value === raw)?.label ?? raw;
    case "text":
      return raw;
  }
}
