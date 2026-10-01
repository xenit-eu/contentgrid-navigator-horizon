import { describe, expect, it } from "vitest";
import { expansionKey, graphEdgeId } from "./graph-ids";
import { type GraphState, focusOf, graphReducer, initialGraphState } from "./graph-state";

const root = { entityName: "customer", id: "c-1" };
const order = { entityName: "order", id: "o-1" };
const product = { entityName: "product", id: "p-1" };
const supplier = { entityName: "supplier", id: "s-1" };

function assertInvariants(state: GraphState) {
  expect(state.trail.length).toBeGreaterThanOrEqual(1);
  expect(state.trail[0]).toMatchObject(state.root);
  for (let i = 1; i < state.trail.length; i++) {
    expect(state.trail[i]).not.toMatchObject({
      entityName: state.trail[i - 1]!.entityName,
      id: state.trail[i - 1]!.id,
    });
  }
}

describe("initialGraphState", () => {
  it("starts at the root", () => {
    const state = initialGraphState(root);
    expect(state.trail).toEqual([root]);
    expect(focusOf(state)).toEqual(root);
    assertInvariants(state);
  });

  it("restores a trail after the root, collapsing cycles and duplicates", () => {
    const state = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...order, via: "orders" },
      { ...product, via: "products" },
      { ...root, via: "customer" },
      { ...order, via: "orders" },
    ]);
    expect(state.trail).toEqual([root, { ...order, via: "orders" }]);
    assertInvariants(state);
  });
});

describe("graphReducer", () => {
  it("explore appends the item after the focus and selects it", () => {
    const state = graphReducer(initialGraphState(root), {
      type: "explore",
      ref: order,
      via: "orders",
    });
    expect(state.trail).toEqual([root, { ...order, via: "orders" }]);
    expect(state.selected).toEqual({ kind: "node", ref: order });
    assertInvariants(state);
  });

  it("explore of an item already in the trail truncates back to it", () => {
    let state = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...product, via: "products" },
    ]);
    state = graphReducer(state, { type: "explore", ref: root, via: "customer" });
    expect(state.trail).toEqual([root]);
    assertInvariants(state);
  });

  it("explore from an earlier trail index replaces the entries after it", () => {
    let state = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...product, via: "products" },
    ]);
    state = graphReducer(state, { type: "explore", ref: supplier, via: "supplier", fromIndex: 1 });
    expect(state.trail).toEqual([
      root,
      { ...order, via: "orders" },
      { ...supplier, via: "supplier" },
    ]);
    assertInvariants(state);
  });

  it("explore of the current focus only selects it", () => {
    const start = initialGraphState(root, [{ ...order, via: "orders" }]);
    const state = graphReducer(start, { type: "explore", ref: order });
    expect(state.trail).toBe(start.trail);
    expect(state.selected).toEqual({ kind: "node", ref: order });
  });

  it("returnTo truncates the trail and ignores out-of-range indexes", () => {
    const start = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...product, via: "products" },
    ]);
    expect(graphReducer(start, { type: "returnTo", index: 0 }).trail).toEqual([root]);
    expect(graphReducer(start, { type: "returnTo", index: 5 })).toBe(start);
    expect(graphReducer(start, { type: "returnTo", index: -1 })).toBe(start);
  });

  it("select does not touch the trail", () => {
    const start = initialGraphState(root, [{ ...order, via: "orders" }]);
    const state = graphReducer(start, { type: "select", selection: { kind: "edge", edgeId: "x" } });
    expect(state.trail).toBe(start.trail);
    expect(state.selected).toEqual({ kind: "edge", edgeId: "x" });
  });

  it("pin adds a target once per owner relation", () => {
    let state = graphReducer(initialGraphState(root), {
      type: "pin",
      owner: root,
      relation: "orders",
      ref: order,
    });
    state = graphReducer(state, { type: "pin", owner: root, relation: "orders", ref: order });
    expect(state.pinned[expansionKey("c-1", "orders")]).toEqual([order]);
  });

  it("linkRemoved unpins, truncates a trail that walked through the link, clears the edge selection", () => {
    let state = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...product, via: "products" },
    ]);
    state = graphReducer(state, { type: "pin", owner: root, relation: "orders", ref: order });
    state = graphReducer(state, {
      type: "select",
      selection: { kind: "edge", edgeId: graphEdgeId("c-1", "orders", "o-1") },
    });
    state = graphReducer(state, {
      type: "linkRemoved",
      owner: root,
      relation: "orders",
      target: order,
    });
    expect(state.trail).toEqual([root]);
    expect(state.pinned).toEqual({});
    expect(state.selected).toBeNull();
    assertInvariants(state);
  });

  it("linkRemoved of a link the trail did not use keeps the trail", () => {
    const start = initialGraphState(root, [{ ...order, via: "orders" }]);
    const state = graphReducer(start, {
      type: "linkRemoved",
      owner: order,
      relation: "products",
      target: product,
    });
    expect(state.trail).toEqual(start.trail);
  });

  it("itemDeleted of the focus moves focus back to the previous trail entry", () => {
    let state = initialGraphState(root, [{ ...order, via: "orders" }]);
    state = graphReducer(state, { type: "select", selection: { kind: "node", ref: order } });
    state = graphReducer(state, { type: "itemDeleted", ref: order });
    expect(state.trail).toEqual([root]);
    expect(state.selected).toBeNull();
    expect(state.rootDeleted).toBe(false);
  });

  it("itemDeleted unpins the item everywhere and drops pins owned by it", () => {
    let state = initialGraphState(root, [{ ...order, via: "orders" }]);
    state = graphReducer(state, { type: "pin", owner: root, relation: "orders", ref: order });
    state = graphReducer(state, { type: "pin", owner: order, relation: "products", ref: product });
    state = graphReducer(state, { type: "itemDeleted", ref: order });
    expect(state.pinned).toEqual({});
  });

  it("itemDeleted of the root marks the root deleted", () => {
    let state = initialGraphState(root, [{ ...order, via: "orders" }]);
    state = graphReducer(state, { type: "itemDeleted", ref: root });
    expect(state.rootDeleted).toBe(true);
    expect(state.trail).toEqual([root]);
    assertInvariants(state);
  });

  it("trailEntryUnavailable truncates before the entry but never removes the root", () => {
    const start = initialGraphState(root, [
      { ...order, via: "orders" },
      { ...product, via: "products" },
    ]);
    expect(graphReducer(start, { type: "trailEntryUnavailable", index: 2 }).trail).toHaveLength(2);
    expect(graphReducer(start, { type: "trailEntryUnavailable", index: 0 })).toBe(start);
  });

  it("reset re-initialises the trail from external state", () => {
    const start = initialGraphState(root, [{ ...order, via: "orders" }]);
    const state = graphReducer(start, { type: "reset", root, trailAfterRoot: [] });
    expect(state.trail).toEqual([root]);
    expect(state.selected).toBeNull();
  });
});
