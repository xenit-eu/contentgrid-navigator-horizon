import { describe, expect, it } from "vitest";
import {
  expansionKey,
  graphEdgeId,
  graphNodeId,
  overflowNodeId,
  sameRef,
  unavailableNodeId,
} from "./graph-ids";

const order = { entityName: "order", id: "o-1" };

describe("graph ids", () => {
  it("keys an item node by its id alone", () => {
    expect(graphNodeId(order)).toBe("o-1");
    expect(graphNodeId({ entityName: "customer", id: "o-1" })).toBe(graphNodeId(order));
  });

  it("builds distinct placeholder ids per owner and relation", () => {
    expect(overflowNodeId(order, "products")).toBe("overflow:o-1:products");
    expect(unavailableNodeId(order, "customer")).toBe("unavailable:o-1:customer");
    expect(overflowNodeId(order, "products")).not.toBe(overflowNodeId(order, "lines"));
  });

  it("builds directional edge ids", () => {
    expect(graphEdgeId("o-1", "customer", "c-1")).toBe("o-1->customer->c-1");
    expect(graphEdgeId("c-1", "customer", "o-1")).not.toBe(graphEdgeId("o-1", "customer", "c-1"));
  });

  it("builds expansion keys", () => {
    expect(expansionKey("o-1", "products")).toBe("o-1::products");
  });

  it("compares refs by entity name and id", () => {
    expect(sameRef(order, { entityName: "order", id: "o-1" })).toBe(true);
    expect(sameRef(order, { entityName: "order", id: "o-2" })).toBe(false);
    expect(sameRef(order, { entityName: "invoice", id: "o-1" })).toBe(false);
  });
});
