import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import { paramLabel, searchTypeLabel } from "./param-labels";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const byName = new Map(
  buildSearchParamDescriptors(
    resolveHalFormsFields(searchTemplate).fields,
    searchTemplate,
    all,
  ).map((d) => [d.name, d]),
);

describe("paramLabel", () => {
  it("uses the attribute title, prefixed by the relation title for relation parameters", () => {
    expect(paramLabel(byName.get("title~prefix")!)).toBe("Title");
    expect(paramLabel(byName.get("customer.name~prefix")!)).toBe("Customer · Name");
  });
});

describe("searchTypeLabel", () => {
  it.each([
    ["title~prefix", "Starts with"],
    ["notes~fts", "Full text"],
    ["reference", "Exact"],
    ["status", "One of"],
    ["quantity", "Integer"],
    ["amount", "Decimal"],
  ])("%s → %s", (name, label) => {
    expect(searchTypeLabel(byName.get(name)!)).toBe(label);
  });
});
