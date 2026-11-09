import { ProfileAttributeType } from "@contentgrid/navigator-data";

/**
 * Absolute (non-relative) formatting shared by the date/datetime renderers and
 * the table variant of created/modified-date. `date` formats without a time
 * component; `datetime` (also the default, since audit timestamps are always
 * full instants) includes one.
 */
export function formatAbsoluteDate(
  value: Date,
  type?: ProfileAttributeType.date | ProfileAttributeType.datetime,
): string {
  return type === ProfileAttributeType.date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value)
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
}
