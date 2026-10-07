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
    expect(applySearchInclusion(descriptors, () => true)).toEqual(descriptors);
  });

  it("drops every parameter of an excluded attribute, ranges included", () => {
    const kept = applySearchInclusion(descriptors, (name) => name !== "quantity").map(
      (d) => d.name,
    );
    expect(kept.filter((n) => n.startsWith("quantity"))).toEqual([]);
    expect(kept).toContain("amount~gte");
  });

  it("never drops relation parameters", () => {
    const kept = applySearchInclusion(descriptors, () => false).map((d) => d.name);
    expect(kept).toEqual(["customer.name~prefix", "owner.email~prefix"]);
  });
});
