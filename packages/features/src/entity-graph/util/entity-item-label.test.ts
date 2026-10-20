import { describe, expect, it } from "vitest";
import { createRelationDemoAccessors } from "@contentgrid/navigator-data/test-fixtures/hal/relation-demo-accessors";
import { RELATION_DEMO_IDS as ids } from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";
import { entityItemLabel } from "./entity-item-label";

const demo = createRelationDemoAccessors();

describe("entityItemLabel", () => {
  it("uses the preferred name attribute's value", () => {
    expect(entityItemLabel(demo.item(ids.bigCorp), { name: "name" })).toBe("Big Corp");
    expect(entityItemLabel(demo.item(ids.order(1)), { name: "number" })).toBe("ORD-001");
  });

  it("falls back to the id when there is no name attribute", () => {
    expect(entityItemLabel(demo.item(ids.bigCorp), undefined)).toBe(ids.bigCorp);
  });

  it("falls back to the id when the attribute is missing on the item", () => {
    expect(entityItemLabel(demo.item(ids.bigCorp), { name: "nickname" })).toBe(ids.bigCorp);
  });
});
