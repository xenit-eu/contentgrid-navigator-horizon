import { describe, expect, it } from "vitest";
import type { GraphModel } from "./build-graph-model";
import { initialGraphState } from "./graph-state";
import { overflowLabel, toKnowledgeGraphProps } from "./to-knowledge-graph-props";

const owner = { entityName: "customer", id: "c-1" };

const model: GraphModel = {
  nodes: [
    {
      kind: "item",
      id: "c-1",
      ref: owner,
      item: undefined,
      label: "Big Corp",
      entityTitle: "Customer",
      color: "red",
      icon: "Database",
      role: "focus",
      loading: false,
      unavailable: false,
      canDelete: true,
    },
    {
      kind: "item",
      id: "o-1",
      ref: { entityName: "order", id: "o-1" },
      item: undefined,
      label: "ORD-001",
      entityTitle: "Order",
      color: undefined,
      icon: "Database",
      role: "target",
      loading: false,
      unavailable: false,
      canDelete: false,
    },
    {
      kind: "overflow",
      id: "overflow:c-1:orders",
      owner,
      relationName: "orders",
      relationTitle: "Orders",
      remaining: 1240,
      isEstimated: true,
      color: undefined,
      targetEntityName: "order",
    },
  ],
  edges: [
    {
      id: "c-1->orders->o-1",
      source: "c-1",
      target: "o-1",
      relationName: "orders",
      relationTitle: "Orders",
      cardinality: "to-many",
      onTrail: false,
      toOverflow: false,
      canRemove: true,
      owner,
    },
  ],
  relationStatus: [],
  expandedNodeIds: ["c-1"],
  truncated: false,
  perRelationCap: 10,
};

describe("overflowLabel", () => {
  it("formats exact, estimated and unknown counts", () => {
    expect(overflowLabel(15, false, "en-US")).toBe("+ 15 more");
    expect(overflowLabel(1240, true, "en-US")).toBe("+ ~1,240 more");
    expect(overflowLabel(null, false, "en-US")).toBe("+ more");
  });
});

describe("toKnowledgeGraphProps", () => {
  it("maps nodes and edges to plain values", () => {
    const props = toKnowledgeGraphProps(model, initialGraphState(owner), "en-US");
    expect(props.focusNodeId).toBe("c-1");
    expect(props.trailNodeIds).toEqual(["c-1"]);
    expect(props.nodes[0]).toMatchObject({
      kind: "item",
      label: "Big Corp",
      sublabel: "Customer",
      emphasis: "focus",
      color: "red",
    });
    expect(props.nodes[1]).toMatchObject({ emphasis: "normal", label: "ORD-001" });
    expect(props.nodes[2]).toMatchObject({
      kind: "overflow",
      label: "+ ~1,240 more",
      estimated: true,
    });
    expect(props.nodes[2]!.ariaLabel).toContain("about 1,240 more Orders of Big Corp");
    expect(props.edges[0]).toMatchObject({ label: "Orders", emphasis: "normal" });
    expect(props.edges[0]!.ariaLabel).toBe("Big Corp — Orders → ORD-001");
  });

  it("carries no accessor objects", () => {
    const props = toKnowledgeGraphProps(model, initialGraphState(owner));
    const json = JSON.parse(JSON.stringify(props));
    expect(json).toEqual(props);
  });

  it("resolves the selected node for node and overflow selections", () => {
    const nodeSel = toKnowledgeGraphProps(model, {
      ...initialGraphState(owner),
      selected: { kind: "node", ref: { entityName: "order", id: "o-1" } },
    });
    expect(nodeSel.selectedNodeId).toBe("o-1");
    const overflowSel = toKnowledgeGraphProps(model, {
      ...initialGraphState(owner),
      selected: { kind: "overflow", owner, relation: "orders" },
    });
    expect(overflowSel.selectedNodeId).toBe("overflow:c-1:orders");
  });
});

describe("toKnowledgeGraphProps — content nodes", () => {
  const withFiles: GraphModel = {
    ...model,
    nodes: [
      ...model.nodes,
      {
        kind: "content",
        id: "content:c-1:contract",
        owner,
        attributeName: "contract",
        attributeTitle: "Contract",
        label: "contract.pdf",
        mimetype: "application/pdf",
      },
      {
        kind: "content",
        id: "content:o-1:invoice",
        owner: { entityName: "order", id: "o-1" },
        attributeName: "invoice",
        attributeTitle: "Invoice",
        label: "invoice.png",
        mimetype: "image/png",
      },
    ],
    edges: [
      ...model.edges,
      {
        ...model.edges[0]!,
        id: "c-1->contract->content:c-1:contract",
        target: "content:c-1:contract",
        toContent: true,
      },
      {
        ...model.edges[0]!,
        id: "o-1->invoice->content:o-1:invoice",
        source: "o-1",
        target: "content:o-1:invoice",
        toContent: true,
      },
    ],
  };

  it("draws the focus item's files in full and other items' files as compact icons", () => {
    const props = toKnowledgeGraphProps(withFiles, initialGraphState(owner));
    const node = (id: string) => props.nodes.find((n) => n.id === id);
    expect(node("content:c-1:contract")).toMatchObject({ compact: false, fileType: "pdf" });
    expect(node("content:o-1:invoice")).toMatchObject({ compact: true, fileType: "img" });

    const edge = (id: string) => props.edges.find((e) => e.id === id);
    expect(edge("c-1->contract->content:c-1:contract")).toMatchObject({
      variant: "content",
      hideLabel: false,
    });
    expect(edge("o-1->invoice->content:o-1:invoice")).toMatchObject({
      variant: "content",
      hideLabel: true,
    });
  });
});
