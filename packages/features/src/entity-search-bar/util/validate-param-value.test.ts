import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import { validateParamValue } from "./validate-param-value";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const byName = new Map(
  buildSearchParamDescriptors(
    resolveHalFormsFields(searchTemplate).fields,
    searchTemplate,
    all,
  ).map((d) => [d.name, d]),
);
const validate = (name: string, raw: string) => validateParamValue(byName.get(name)!, raw);

describe("validateParamValue", () => {
  it("accepts a whole number for an integer parameter and rejects anything else", () => {
    expect(validate("quantity", " 42 ")).toEqual({ ok: true, value: "42" });
    expect(validate("quantity", "4.2")).toEqual({ ok: false, error: "Enter a whole number" });
    expect(validate("quantity", "abc")).toEqual({ ok: false, error: "Enter a number" });
  });

  it("accepts any number for a decimal parameter, including a decimal comma", () => {
    expect(validate("amount", "12,5")).toEqual({ ok: true, value: "12.5" });
    expect(validate("amount", "7")).toEqual({ ok: true, value: "7" });
    expect(validate("amount", "")).toEqual({ ok: false, error: "Enter a number" });
  });

  it("accepts an allowed value by token, label or a unique prefix", () => {
    expect(validate("status", "APPROVED")).toEqual({ ok: true, value: "approved" });
    expect(validate("status", "rej")).toEqual({ ok: true, value: "rejected" });
    expect(validate("status", "x")).toEqual({ ok: false, error: "Pick one of the allowed values" });
  });

  it("applies typed text as is for text parameters", () => {
    expect(validate("title~prefix", " Alp ")).toEqual({ ok: true, value: "Alp" });
  });
});
