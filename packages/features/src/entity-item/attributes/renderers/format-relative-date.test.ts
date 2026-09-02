import { describe, expect, it } from "vitest";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";

const NOW = new Date("2024-06-15T12:00:00.000Z");

describe("formatRelativeOrAbsoluteDate", () => {
  it("formats sub-minute differences in seconds", () => {
    const value = new Date(NOW.getTime() - 30 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(-30, "second"),
    );
  });

  it("formats sub-hour differences in minutes", () => {
    const value = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(-5, "minute"),
    );
  });

  it("formats sub-day differences in hours", () => {
    const value = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(-3, "hour"),
    );
  });

  it("formats differences under 30 days in days", () => {
    const value = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(-20, "day"),
    );
  });

  it("falls back to an absolute date at 30 days or more", () => {
    const value = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(value),
    );
  });

  it("falls back to an absolute date far in the past", () => {
    const value = new Date("2016-06-21T00:00:00.000Z");
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(value),
    );
  });

  it("formats future dates relatively (e.g. 'in 5 minutes')", () => {
    const value = new Date(NOW.getTime() + 5 * 60 * 1000);
    expect(formatRelativeOrAbsoluteDate(value, NOW)).toBe(
      new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(5, "minute"),
    );
  });
});
