import { describe, expect, it } from "vitest";
import { DATE_PRESETS, decodeDateRange, encodeDateRange, resolveDatePreset } from "./date-presets";

// Local-time construction, so the expectations hold in any time zone the tests run in.
const now = new Date(2026, 9, 7, 10, 0, 0);
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const dateOnly = {
  includesTime: false,
  lower: "due_date~from",
  lowerInclusive: true,
  upper: "due_date~until",
  upperInclusive: true,
};
const dateOnlyExclusive = {
  includesTime: false,
  lower: "due_date~after",
  lowerInclusive: false,
  upper: "due_date~before",
  upperInclusive: false,
};
const dateTime = {
  includesTime: true,
  lower: "received_at~after",
  lowerInclusive: false,
  upper: "received_at~before",
  upperInclusive: false,
};

describe("resolveDatePreset", () => {
  it.each([
    ["last-day", local(2026, 10, 6, 10)],
    ["last-week", local(2026, 9, 30, 10)],
    ["last-month", local(2026, 9, 7, 10)],
    ["last-year", local(2025, 10, 7, 10)],
  ] as const)("%s starts at %s and ends now", (id, from) => {
    expect(resolveDatePreset(id, now)).toEqual({ from, to: now });
  });

  it("offers the four presets in order", () => {
    expect(DATE_PRESETS.map((p) => p.label)).toEqual([
      "Last day",
      "Last week",
      "Last month",
      "Last year",
    ]);
  });
});

describe("encodeDateRange", () => {
  it("encodes a datetime range as ISO timestamps", () => {
    const range = resolveDatePreset("last-week", now);
    expect(encodeDateRange(range, dateTime)).toEqual({
      "received_at~after": local(2026, 9, 30, 10).toISOString(),
      "received_at~before": now.toISOString(),
    });
  });

  it("covers whole days for a calendar-picked datetime range", () => {
    expect(
      encodeDateRange({ from: local(2026, 10, 1), to: local(2026, 10, 3) }, dateTime, {
        wholeDays: true,
      }),
    ).toEqual({
      "received_at~after": local(2026, 10, 1).toISOString(),
      "received_at~before": new Date(2026, 9, 3, 23, 59, 59, 999).toISOString(),
    });
  });

  it("encodes a date-only range as inclusive local dates", () => {
    expect(encodeDateRange({ from: local(2026, 10, 1), to: local(2026, 10, 3) }, dateOnly)).toEqual(
      {
        "due_date~from": "2026-10-01",
        "due_date~until": "2026-10-03",
      },
    );
  });

  it("moves exclusive date-only bounds outwards so the range stays inclusive", () => {
    expect(
      encodeDateRange({ from: local(2026, 10, 1), to: local(2026, 10, 3) }, dateOnlyExclusive),
    ).toEqual({
      "due_date~after": "2026-09-30",
      "due_date~before": "2026-10-04",
    });
  });

  it("leaves a missing end unset", () => {
    expect(encodeDateRange({ from: local(2026, 10, 1) }, dateOnly)).toEqual({
      "due_date~from": "2026-10-01",
      "due_date~until": undefined,
    });
  });
});

describe("decodeDateRange", () => {
  it("round-trips date-only ranges, inclusive and exclusive", () => {
    const range = { from: local(2026, 10, 1), to: local(2026, 10, 3) };
    for (const model of [dateOnly, dateOnlyExclusive]) {
      expect(
        decodeDateRange(model, encodeDateRange(range, model) as Record<string, string>),
      ).toEqual(range);
    }
  });

  it("reads datetime bounds", () => {
    expect(
      decodeDateRange(dateTime, { "received_at~after": "2026-10-01T08:00:00.000Z" }).from,
    ).toEqual(new Date("2026-10-01T08:00:00.000Z"));
  });

  it("ignores missing and unreadable values", () => {
    expect(decodeDateRange(dateOnly, { "due_date~from": "nope" })).toEqual({
      from: undefined,
      to: undefined,
    });
  });
});
