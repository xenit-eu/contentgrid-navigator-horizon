/**
 * "1 hour ago" / "20 days ago" for anything within the last 30 days; falls
 * back to an absolute date (e.g. "21/06/2016") beyond that.
 */
export function formatRelativeOrAbsoluteDate(value: Date, now: Date = new Date()): string {
  const diffSeconds = Math.round((now.getTime() - value.getTime()) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(-diffSeconds, "second");
  }
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(-diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(-diffHours, "hour");
  }
  if (Math.abs(diffDays) < 30) {
    return rtf.format(-diffDays, "day");
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}
