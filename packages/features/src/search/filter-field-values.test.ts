import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../hal-forms";
import {
  buildCollectionSearchValues,
  encodeFilterValue,
  filterFieldValues,
} from "./filter-field-values";

const { searchBar } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const { fields } = resolveHalFormsFields(searchTemplate);

describe("encodeFilterValue", () => {
  it("encodes a Date as an ISO string", () => {
    expect(encodeFilterValue(new Date("2026-10-07T10:00:00.000Z"))).toBe(
      "2026-10-07T10:00:00.000Z",
    );
  });

  it("keeps the first element of an array, and drops an empty array", () => {
    expect(encodeFilterValue(["approved", "draft"])).toBe("approved");
    expect(encodeFilterValue([])).toBeUndefined();
  });

  it("drops an empty string and undefined", () => {
    expect(encodeFilterValue("")).toBeUndefined();
    expect(encodeFilterValue(undefined)).toBeUndefined();
  });

  it("stringifies numbers and booleans", () => {
    expect(encodeFilterValue(42)).toBe("42");
    expect(encodeFilterValue(false)).toBe("false");
  });
});

describe("filterFieldValues", () => {
  it("coerces present values by wire type and round-trips through encodeFilterValue", () => {
    const filters = {
      "quantity~gte": "3",
      urgent: "true",
      "received_at~after": "2026-10-01T00:00:00.000Z",
      "title~prefix": "Alp",
    };
    const values = filterFieldValues(fields, filters);

    expect(values["quantity~gte"]).toBe(3);
    expect(values.urgent).toBe(true);
    expect(values["received_at~after"]).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(values["title~prefix"]).toBe("Alp");

    for (const [key, raw] of Object.entries(filters)) {
      expect(encodeFilterValue(values[key])).toBe(raw);
    }
  });

  it("uses the empty default for absent filters", () => {
    const values = filterFieldValues(fields, {});
    expect(values.urgent).toBeUndefined();
    expect(values["quantity~gte"]).toBe("");
  });
});

describe("buildCollectionSearchValues", () => {
  it("applies filters without a sort", () => {
    const values = buildCollectionSearchValues(searchTemplate, fields, { "quantity~gte": "3" });
    const url = new URL(searchBar.searchEntityRequest(values).url);
    expect(url.searchParams.get("quantity~gte")).toBe("3");
    expect(url.searchParams.has("_sort")).toBe(false);
  });

  it("adds the sort as a single-element _sort value", () => {
    const values = buildCollectionSearchValues(searchTemplate, fields, {}, "title,desc");
    const url = new URL(searchBar.searchEntityRequest(values).url);
    expect(url.searchParams.getAll("_sort")).toEqual(["title,desc"]);
  });
});
