import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { applySearchInclusion } from "./apply-search-inclusion";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);

describe("applySearchInclusion", () => {
  it("keeps everything when every attribute is included", () => {
    expect(applySearchInclusion(descriptors, "all")).toEqual(descriptors);
  });

  it("drops every parameter of an excluded attribute, ranges included", () => {
    const included = new Set(descriptors.map((d) => d.groupKey).filter((n) => n !== "quantity"));
    const kept = applySearchInclusion(descriptors, included).map((d) => d.name);
    expect(kept.filter((n) => n.startsWith("quantity"))).toEqual([]);
    expect(kept).toContain("amount~gte");
  });

  it("keeps relation parameters while at least one attribute is included", () => {
    const kept = applySearchInclusion(descriptors, new Set(["title"])).map((d) => d.name);
    expect(kept.filter((n) => !n.startsWith("title"))).toEqual([
      "customer.name~prefix",
      "owner.email~prefix",
    ]);
  });

  it("drops everything, relation parameters included, when no attribute is included", () => {
    expect(applySearchInclusion(descriptors, new Set())).toEqual([]);
    expect(applySearchInclusion(descriptors, new Set(["renamed_away"]))).toEqual([]);
  });

  it("keeps relation parameters of an entity without searchable attributes of its own", () => {
    const relationOnly = descriptors.filter((d) => d.relation !== undefined);
    expect(applySearchInclusion(relationOnly, new Set())).toEqual(relationOnly);
  });
});
