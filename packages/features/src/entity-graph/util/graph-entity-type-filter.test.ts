import { describe, expect, it } from "vitest";
import type { GraphEdgeModel, GraphItemNodeModel, GraphModel } from "./build-graph-model";
import { filterGraphModel, graphEntityTypes } from "./graph-entity-type-filter";

const customer = { entityName: "customer", id: "c-1" };

function itemNode(
  id: string,
  entityName: string,
  role: GraphItemNodeModel["role"] = "target",
): GraphItemNodeModel {
  return {
    kind: "item",
    id,
    ref: { entityName, id },
    item: undefined,
    label: id,
    entityTitle: entityName.toUpperCase(),
    color: `${entityName}-color`,
    icon: "Database",
    role,
    loading: false,
    unavailable: false,
    canDelete: false,
  };
}

function edge(source: string, target: string): GraphEdgeModel {
  return {
    id: `${source}->rel->${target}`,
    source,
    target,
    relationName: "rel",
    relationTitle: "Rel",
    cardinality: "to-many",
    onTrail: false,
    toOverflow: false,
    canRemove: false,
    owner: customer,
  };
}

const model: GraphModel = {
  nodes: [
    itemNode("c-1", "customer", "focus"),
    itemNode("o-1", "order"),
    itemNode("o-2", "order"),
    itemNode("c-2", "customer"),
    {
      kind: "overflow",
      id: "overflow:c-1:orders",
      owner: customer,
      relationName: "orders",
      relationTitle: "Orders",
      remaining: 5,
      isEstimated: false,
      color: undefined,
      targetEntityName: "order",
    },
  ],
  edges: [
    edge("c-1", "o-1"),
    edge("c-1", "o-2"),
    edge("c-1", "c-2"),
    edge("c-1", "overflow:c-1:orders"),
  ],
  relationStatus: [],
  expandedNodeIds: ["c-1"],
  truncated: false,
  perRelationCap: 10,
};

describe("graphEntityTypes", () => {
  it("lists each item type once, in order of appearance, with its node count", () => {
    expect(graphEntityTypes(model)).toEqual([
      {
        entityName: "customer",
        title: "CUSTOMER",
        color: "customer-color",
        icon: "Database",
        count: 2,
      },
      { entityName: "order", title: "ORDER", color: "order-color", icon: "Database", count: 2 },
    ]);
  });
});

describe("filterGraphModel", () => {
  it("returns the model untouched when nothing is hidden", () => {
    expect(filterGraphModel(model, new Set())).toBe(model);
  });

  it("drops the hidden type's targets, its overflow node and their edges", () => {
    const filtered = filterGraphModel(model, new Set(["order"]));
    expect(filtered.nodes.map((n) => n.id)).toEqual(["c-1", "c-2"]);
    expect(filtered.edges.map((e) => e.target)).toEqual(["c-2"]);
  });

  it("keeps the expanded item's content nodes whatever is hidden", () => {
    const withContent: GraphModel = {
      ...model,
      nodes: [
        ...model.nodes,
        {
          kind: "content",
          id: "content:c-1:contract",
          owner: customer,
          attributeName: "contract",
          attributeTitle: "Contract",
          label: "contract.pdf",
          mimetype: "application/pdf",
        },
      ],
      edges: [...model.edges, edge("c-1", "content:c-1:contract")],
    };
    const filtered = filterGraphModel(withContent, new Set(["customer", "order"]));
    expect(filtered.nodes.map((n) => n.id)).toEqual(["c-1", "content:c-1:contract"]);
    expect(filtered.edges.map((e) => e.target)).toEqual(["content:c-1:contract"]);
  });

  it("keeps the focus item even when its own type is hidden", () => {
    const filtered = filterGraphModel(model, new Set(["customer"]));
    expect(filtered.nodes.map((n) => n.id)).toEqual(["c-1", "o-1", "o-2", "overflow:c-1:orders"]);
  });
});
