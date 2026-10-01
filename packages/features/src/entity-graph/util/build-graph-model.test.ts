import { describe, expect, it, vi } from "vitest";
import { ProblemDetailError } from "@contentgrid/navigator-data";
import type { EntityItem, ProfileEntity, RelationTargets } from "@contentgrid/navigator-data";
import { createRelationDemoAccessors } from "@contentgrid/navigator-data/test-fixtures/hal/relation-demo-accessors";
import { RELATION_DEMO_IDS as ids } from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";
import {
  type BuildGraphModelInput,
  type GraphDisplay,
  type GraphItemLoad,
  type GraphItemNodeModel,
  type GraphOverflowNodeModel,
  buildGraphModel,
} from "./build-graph-model";
import { expansionKey } from "./graph-ids";
import { type GraphState, graphReducer, initialGraphState } from "./graph-state";

const demo = createRelationDemoAccessors();

const display = (p: ProfileEntity): GraphDisplay => ({
  color: p.name === "customer" ? "oklch(0.55 0.17 155)" : undefined,
  icon: "Database",
  nameAttribute: { name: p.name === "order" ? "number" : "name" },
});

/** Success-state relation targets of `item`, read from the demo model. */
function expansionOf(item: EntityItem): RelationTargets[] {
  return [
    ...item.toOneRelations.map(
      (relation): RelationTargets => ({
        kind: "to-one",
        relation,
        targetProfile: demo.profile(relation.profileRelation.targetProfileLink!.name!),
        status: "success",
        error: null,
        target: demo.toOneTarget(item.id, relation.name),
        refetch: vi.fn(),
      }),
    ),
    ...item.toManyRelations.map(
      (relation): RelationTargets => ({
        kind: "to-many",
        relation,
        targetProfile: demo.profile(relation.profileRelation.targetProfileLink!.name!),
        status: "success",
        error: null,
        collection: demo.toManyPage(item.id, relation.name),
        refetch: vi.fn(),
      }),
    ),
  ];
}

function inputFor(
  state: GraphState,
  overrides: Partial<BuildGraphModelInput> & { expand?: Record<string, RelationTargets[]> } = {},
): BuildGraphModelInput {
  const items = new Map<string, GraphItemLoad>();
  const expansions = new Map<string, readonly RelationTargets[]>();
  const trail = state.trail;
  trail.forEach((entry, i) => {
    const item = demo.item(entry.id);
    items.set(entry.id, { item, status: "success", unavailable: false });
    if (i >= trail.length - 2) {
      expansions.set(entry.id, overrides.expand?.[entry.id] ?? expansionOf(item));
    }
  });
  for (const refs of Object.values(state.pinned)) {
    for (const ref of refs)
      items.set(ref.id, { item: demo.item(ref.id), status: "success", unavailable: false });
  }
  return {
    state,
    items,
    expansions,
    display,
    entityTitle: (name) => demo.profile(name).title,
    ...overrides,
  };
}

const ref = (entityName: string, id: string) => ({ entityName, id });
const itemNodes = (nodes: readonly { kind: string }[]) =>
  nodes.filter((n): n is GraphItemNodeModel => n.kind === "item");
const overflowNodes = (nodes: readonly { kind: string }[]) =>
  nodes.filter((n): n is GraphOverflowNodeModel => n.kind === "overflow");

describe("buildGraphModel — relations of the focus item", () => {
  it("draws one edge for a set to-one relation and none for an empty one (FR-006)", () => {
    const withSupplier = buildGraphModel(
      inputFor(initialGraphState(ref("product", ids.product(1)))),
    );
    expect(withSupplier.edges.map((e) => [e.relationName, e.target])).toEqual([
      ["supplier", ids.acme],
    ]);

    const empty = buildGraphModel(inputFor(initialGraphState(ref("product", ids.product(5)))));
    expect(empty.edges).toEqual([]);
    expect(empty.nodes).toHaveLength(1);
  });

  it("draws every target of a small to-many relation without overflow", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("order", ids.order(1)))));
    const products = model.edges.filter((e) => e.relationName === "products");
    expect(products.map((e) => e.target)).toEqual([ids.product(1), ids.product(2), ids.product(3)]);
    expect(overflowNodes(model.nodes)).toEqual([]);
    expect(
      products.every((e) => e.relationTitle === "Products" && e.cardinality === "to-many"),
    ).toBe(true);
  });

  it("caps a large to-many relation at 10 plus an overflow node (FR-007/FR-008)", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("customer", ids.bigCorp))));
    const orders = model.edges.filter((e) => e.relationName === "orders" && !e.toOverflow);
    expect(orders).toHaveLength(10);
    const [overflow] = overflowNodes(model.nodes);
    // Big Corp reports only an estimate of 25.
    expect(overflow).toMatchObject({ remaining: 15, isEstimated: true, relationName: "orders" });
    expect(model.edges.some((e) => e.toOverflow && e.target === overflow!.id && !e.canRemove)).toBe(
      true,
    );
  });

  it("reports an estimated count as estimated and an exact count as exact", () => {
    const bigCorp = demo.item(ids.bigCorp);
    const [orders] = expansionOf(bigCorp);
    if (orders?.kind !== "to-many") throw new Error("expected to-many");
    const estimated = {
      ...orders,
      collection: {
        ...orders.collection!,
        items: orders.collection!.items,
        totalItems: { count: 1250, isEstimated: true },
        hasNext: true,
      },
    } as unknown as RelationTargets;
    const model = buildGraphModel(
      inputFor(initialGraphState(ref("customer", ids.bigCorp)), {
        expand: { [ids.bigCorp]: [estimated] },
      }),
    );
    expect(overflowNodes(model.nodes)[0]).toMatchObject({ remaining: 1240, isEstimated: true });
  });

  it("shows 'more' without a number when the server gives no count but has a next page", () => {
    const bigCorp = demo.item(ids.bigCorp);
    const [orders] = expansionOf(bigCorp);
    const noCount = {
      ...orders,
      collection: {
        items: orders!.kind === "to-many" ? orders!.collection!.items : [],
        totalItems: undefined,
        hasNext: true,
      },
    } as unknown as RelationTargets;
    const model = buildGraphModel(
      inputFor(initialGraphState(ref("customer", ids.bigCorp)), {
        expand: { [ids.bigCorp]: [noCount] },
      }),
    );
    expect(overflowNodes(model.nodes)[0]).toMatchObject({ remaining: null });
  });

  it("uses one node for an item reached by two relations, with two labelled edges (FR-002)", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("employee", ids.alice))));
    const toBob = model.edges.filter((e) => e.source === ids.alice && e.target === ids.bob);
    expect(toBob.map((e) => e.relationTitle).sort()).toEqual(["Boss", "Colleagues"]);
    expect(itemNodes(model.nodes).filter((n) => n.id === ids.bob)).toHaveLength(1);
  });

  it("draws a self-relation as a self-loop edge", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("employee", ids.alice))));
    expect(model.edges.some((e) => e.source === ids.alice && e.target === ids.alice)).toBe(true);
  });

  it("applies display colour, icon and label from the preferred name attribute (FR-009)", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("order", ids.order(1)))));
    const customer = itemNodes(model.nodes).find((n) => n.id === ids.bigCorp)!;
    expect(customer).toMatchObject({
      label: "Big Corp",
      color: "oklch(0.55 0.17 155)",
      entityTitle: "Customer",
    });
    const focus = itemNodes(model.nodes).find((n) => n.id === ids.order(1))!;
    expect(focus).toMatchObject({ label: "ORD-001", role: "focus", color: undefined });
  });
});

describe("buildGraphModel — trail and retention (FR-013/FR-015)", () => {
  it("expands the focus and the previous focus; older entries are trail-only", () => {
    const state = initialGraphState(ref("customer", ids.bigCorp), [
      { ...ref("order", ids.order(1)), via: "orders" },
      { ...ref("product", ids.product(1)), via: "products" },
    ]);
    const model = buildGraphModel(inputFor(state));
    const byId = new Map(itemNodes(model.nodes).map((n) => [n.id, n]));

    expect(byId.get(ids.product(1))?.role).toBe("focus");
    expect(byId.get(ids.order(1))?.role).toBe("previous-focus");
    expect(byId.get(ids.bigCorp)?.role).toBe("trail");
    expect(model.expandedNodeIds).toEqual([ids.product(1), ids.order(1)]);

    // The root keeps only its trail edge to the order — none of its other orders are drawn.
    const fromRoot = model.edges.filter((e) => e.source === ids.bigCorp);
    expect(fromRoot.map((e) => [e.target, e.onTrail])).toEqual([[ids.order(1), true]]);
    expect(byId.has(ids.order(2))).toBe(false);

    // Order's own relations are expanded: its customer edge + products.
    expect(
      model.edges.some((e) => e.source === ids.order(1) && e.relationName === "customer"),
    ).toBe(true);
    expect(
      model.edges.some((e) => e.source === ids.product(1) && e.relationName === "supplier"),
    ).toBe(true);
  });

  it("merges a trail edge with the same expansion edge and keeps it on-trail", () => {
    const state = initialGraphState(ref("customer", ids.bigCorp), [
      { ...ref("order", ids.order(1)), via: "orders" },
    ]);
    const model = buildGraphModel(inputFor(state));
    const edges = model.edges.filter((e) => e.source === ids.bigCorp && e.target === ids.order(1));
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ onTrail: true, relationName: "orders" });
  });
});

describe("buildGraphModel — node budget (SC-002)", () => {
  it("collapses the previous focus first when over budget", () => {
    const state = initialGraphState(ref("customer", ids.bigCorp), [
      { ...ref("order", ids.order(1)), via: "orders" },
    ]);
    const model = buildGraphModel({ ...inputFor(state), nodeBudget: 8 });
    expect(model.truncated).toBe(true);
    expect(model.nodes.length).toBeLessThanOrEqual(8);
    expect(model.expandedNodeIds).toEqual([ids.order(1)]);
    expect(itemNodes(model.nodes).find((n) => n.id === ids.bigCorp)?.role).toBe("trail");
    expect(model.perRelationCap).toBe(10);
  });

  it("lowers the per-relation cap when the focus alone is over budget", () => {
    const model = buildGraphModel({
      ...inputFor(initialGraphState(ref("customer", ids.bigCorp))),
      nodeBudget: 5,
    });
    expect(model.nodes.length).toBeLessThanOrEqual(5);
    expect(model.perRelationCap).toBe(3);
    expect(overflowNodes(model.nodes)[0]).toMatchObject({ remaining: 22 });
    expect(model.truncated).toBe(true);
  });

  it("never exceeds 50 nodes with the default budget", () => {
    let state = initialGraphState(ref("customer", ids.bigCorp));
    const walk = [
      { ...ref("order", ids.order(1)), via: "orders" },
      { ...ref("product", ids.product(1)), via: "products" },
      { ...ref("supplier", ids.acme), via: "supplier" },
    ];
    for (const step of walk) {
      state = graphReducer(state, { type: "explore", ref: step, via: step.via });
      expect(buildGraphModel(inputFor(state)).nodes.length).toBeLessThanOrEqual(50);
    }
  });
});

describe("buildGraphModel — pinned targets", () => {
  it("adds pinned targets from later pages and reduces the overflow count, never below zero", () => {
    let state = initialGraphState(ref("customer", ids.bigCorp));
    state = graphReducer(state, {
      type: "pin",
      owner: ref("customer", ids.bigCorp),
      relation: "orders",
      ref: ref("order", ids.order(15)),
    });
    // Pinning something already shown is not double-counted.
    state = graphReducer(state, {
      type: "pin",
      owner: ref("customer", ids.bigCorp),
      relation: "orders",
      ref: ref("order", ids.order(1)),
    });
    expect(state.pinned[expansionKey(ids.bigCorp, "orders")]).toHaveLength(2);

    const model = buildGraphModel(inputFor(state));
    expect(model.edges.some((e) => e.target === ids.order(15) && e.relationName === "orders")).toBe(
      true,
    );
    expect(overflowNodes(model.nodes)[0]).toMatchObject({ remaining: 14 });
  });
});

describe("buildGraphModel — permissions and failures", () => {
  it("derives canRemove from canClear (to-one) / canUnlinkItem (to-many) and canDelete from the item", () => {
    const model = buildGraphModel(inputFor(initialGraphState(ref("order", ids.order(2)))));
    const customerEdge = model.edges.find((e) => e.relationName === "customer")!;
    expect(customerEdge.canRemove).toBe(false); // ORD-002 has no clear-customer template
    const productEdge = model.edges.find((e) => e.relationName === "products")!;
    expect(productEdge.canRemove).toBe(true);

    const order1 = buildGraphModel(inputFor(initialGraphState(ref("order", ids.order(1)))));
    expect(itemNodes(order1.nodes).find((n) => n.id === ids.order(1))?.canDelete).toBe(false);
    expect(itemNodes(order1.nodes).find((n) => n.id === ids.product(1))?.canDelete).toBe(true);
  });

  it("shows an unreadable to-one target as an unavailable node", () => {
    const product = demo.item(ids.product(1));
    const [supplier] = expansionOf(product);
    const denied = {
      ...supplier,
      status: "error",
      target: undefined,
      error: new ProblemDetailError({ status: 403, title: "Forbidden" }),
    } as unknown as RelationTargets;
    const model = buildGraphModel(
      inputFor(initialGraphState(ref("product", ids.product(1))), {
        expand: { [ids.product(1)]: [denied] },
      }),
    );
    const node = itemNodes(model.nodes).find((n) => n.unavailable);
    expect(node).toMatchObject({
      label: "Unavailable item",
      entityTitle: "Supplier",
      canDelete: false,
    });
    expect(model.relationStatus).toEqual([]);
  });

  it("reports pending and failing relations in relationStatus without drawing them", () => {
    const order = demo.item(ids.order(1));
    const [customer, products] = expansionOf(order);
    const retry = vi.fn();
    const pending = {
      ...customer,
      status: "pending",
      target: undefined,
    } as unknown as RelationTargets;
    const failed = {
      ...products,
      status: "error",
      collection: undefined,
      error: new Error("boom"),
      refetch: retry,
    } as unknown as RelationTargets;
    const model = buildGraphModel(
      inputFor(initialGraphState(ref("order", ids.order(1))), {
        expand: { [ids.order(1)]: [pending, failed] },
      }),
    );
    expect(model.relationStatus.map((s) => [s.relationName, s.status])).toEqual([
      ["customer", "pending"],
      ["products", "error"],
    ]);
    model.relationStatus[1]!.retry();
    expect(retry).toHaveBeenCalled();
    expect(model.nodes).toHaveLength(1);
  });
});
