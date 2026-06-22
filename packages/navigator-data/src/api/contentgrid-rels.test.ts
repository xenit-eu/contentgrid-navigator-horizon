import { describe, expect, it } from "vitest";
import { blueprintRels, cgRels } from "./contentgrid-rels";

describe("cgRels", () => {
  it("entity resolves to the correct URI", () => {
    expect(cgRels.entity.value).toBe("https://contentgrid.cloud/rels/contentgrid/entity");
  });

  it("profile resolves to the correct URI", () => {
    expect(cgRels.profile.value).toBe("https://contentgrid.cloud/rels/contentgrid/profile");
  });

  it("content resolves to the correct URI", () => {
    expect(cgRels.content.value).toBe("https://contentgrid.cloud/rels/contentgrid/content");
  });

  it("relation resolves to the correct URI", () => {
    expect(cgRels.relation.value).toBe("https://contentgrid.cloud/rels/contentgrid/relation");
  });
});

describe("blueprintRels", () => {
  it("attribute resolves to the correct URI", () => {
    expect(blueprintRels.attribute.value).toBe(
      "https://contentgrid.cloud/rels/blueprint/attribute",
    );
  });

  it("relation resolves to the correct URI", () => {
    expect(blueprintRels.relation.value).toBe("https://contentgrid.cloud/rels/blueprint/relation");
  });

  it("targetEntity resolves to the correct URI", () => {
    expect(blueprintRels["target-entity"].value).toBe(
      "https://contentgrid.cloud/rels/blueprint/target-entity",
    );
  });

  it("constraint resolves to the correct URI", () => {
    expect(blueprintRels.constraint.value).toBe(
      "https://contentgrid.cloud/rels/blueprint/constraint",
    );
  });
});
