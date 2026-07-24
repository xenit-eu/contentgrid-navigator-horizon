import { describe, expect, it } from "vitest";
import { blueprintRels, cgRels } from "./contentgrid-rels";

/** Reduce a rels record down to its `.value` strings for a single structural comparison. */
function values(rels: Record<string, { value: string }>): Record<string, string> {
  return Object.fromEntries(Object.entries(rels).map(([key, rel]) => [key, rel.value]));
}

describe("cgRels", () => {
  it("expands every rel to its full URI", () => {
    expect(values(cgRels)).toEqual({
      entity: "https://contentgrid.cloud/rels/contentgrid/entity",
      content: "https://contentgrid.cloud/rels/contentgrid/content",
      relation: "https://contentgrid.cloud/rels/contentgrid/relation",
      profile: "https://contentgrid.cloud/rels/contentgrid/profile",
    });
  });
});

describe("blueprintRels", () => {
  it("expands every rel to its full URI", () => {
    expect(values(blueprintRels)).toEqual({
      attribute: "https://contentgrid.cloud/rels/blueprint/attribute",
      constraint: "https://contentgrid.cloud/rels/blueprint/constraint",
      "search-param": "https://contentgrid.cloud/rels/blueprint/search-param",
      relation: "https://contentgrid.cloud/rels/blueprint/relation",
      "target-entity": "https://contentgrid.cloud/rels/blueprint/target-entity",
    });
  });
});
