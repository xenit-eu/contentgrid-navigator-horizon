import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import { formatFilterValue } from "./format-filter-value";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const byName = new Map(
  buildSearchParamDescriptors(
    resolveHalFormsFields(searchTemplate).fields,
    searchTemplate,
    all,
  ).map((d) => [d.name, d]),
);
const format = (name: string, raw: string) =>
  formatFilterValue(byName.get(name)!, raw, { locale: "en-GB", timeZone: "UTC" });

describe("formatFilterValue", () => {
  it("formats a date without shifting it by a day", () => {
    expect(format("due_date~from", "2026-10-01")).toBe("1 Oct 2026");
  });

  it("formats a datetime in the given time zone", () => {
    expect(format("received_at~after", "2026-10-02T09:00:00.000Z")).toBe("2 Oct 2026, 09:00");
  });

  it("formats numbers with locale grouping and keeps decimals", () => {
    expect(format("quantity", "12000")).toBe("12,000");
    expect(format("amount", "99.95")).toBe("99.95");
  });

  it("shows booleans as True / False", () => {
    expect(format("urgent", "true")).toBe("True");
    expect(format("urgent", "false")).toBe("False");
  });

  it("shows an allowed value by its option label, falling back to the raw value", () => {
    expect(format("status", "approved")).toBe("approved");
    expect(format("status", "archived")).toBe("archived");
  });

  it("keeps unreadable values as they are", () => {
    expect(format("due_date~from", "not-a-date")).toBe("not-a-date");
    expect(format("quantity", "abc")).toBe("abc");
    expect(format("title~prefix", "Alp")).toBe("Alp");
  });
});
