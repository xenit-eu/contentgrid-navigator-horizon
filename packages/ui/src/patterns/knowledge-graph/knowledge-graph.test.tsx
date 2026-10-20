import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeGraph } from "./knowledge-graph";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphProps,
} from "./knowledge-graph.types";

const nodes: KnowledgeGraphNode[] = [
  {
    id: "c-1",
    kind: "item",
    label: "Big Corp",
    sublabel: "Customer",
    emphasis: "focus",
    ariaLabel: "Customer Big Corp",
  },
  {
    id: "o-1",
    kind: "item",
    label: "ORD-001",
    sublabel: "Order",
    emphasis: "normal",
    ariaLabel: "Order ORD-001",
  },
  {
    id: "ov",
    kind: "overflow",
    label: "+ ~15 more",
    sublabel: "Orders",
    emphasis: "normal",
    estimated: true,
    ariaLabel: "about 15 more Orders",
  },
];
const edges: KnowledgeGraphEdge[] = [
  {
    id: "c-1->orders->o-1",
    source: "c-1",
    target: "o-1",
    label: "Orders",
    emphasis: "normal",
    ariaLabel: "Big Corp — Orders → ORD-001",
  },
  {
    id: "c-1->orders->ov",
    source: "c-1",
    target: "ov",
    label: "Orders",
    emphasis: "normal",
    ariaLabel: "Orders of Big Corp: more items",
  },
];

function renderGraph(overrides: Partial<KnowledgeGraphProps> = {}) {
  const props: KnowledgeGraphProps = {
    nodes,
    edges,
    focusNodeId: "c-1",
    trailNodeIds: ["c-1"],
    onNodeClick: vi.fn(),
    onEdgeClick: vi.fn(),
    onMenuOpenChange: vi.fn(),
    ...overrides,
  };
  const view = render(
    <div style={{ width: 800, height: 600 }}>
      <KnowledgeGraph {...props} />
    </div>,
  );
  return { ...view, props };
}

describe("KnowledgeGraph", () => {
  it("renders node labels, the overflow pill and edge labels", async () => {
    renderGraph();
    expect(screen.getByText("Big Corp")).toBeInTheDocument();
    expect(screen.getByText("ORD-001")).toBeInTheDocument();
    expect(screen.getByText("+ ~15 more")).toBeInTheDocument();
    expect(screen.getByText("(estimated)", { exact: false })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Big Corp — Orders → ORD-001" }),
      ).toBeInTheDocument(),
    );
  });

  it("exposes the canvas as a labelled application with a usage hint", () => {
    renderGraph();
    const app = screen.getByRole("application", { name: "Relations graph" });
    expect(app).toHaveAccessibleDescription(/Tab to move between items/);
  });

  it("reports node clicks by id", async () => {
    const { props } = renderGraph();
    // fireEvent, not userEvent: d3-drag/zoom (inside React Flow) crash on userEvent's synthetic
    // mousedown in jsdom (no event.view) — see the React Flow testing guide.
    fireEvent.click(screen.getByText("ORD-001"));
    expect(props.onNodeClick).toHaveBeenCalledWith("o-1");
  });

  it("reports edge-label clicks by id", async () => {
    const { props } = renderGraph();
    const label = await screen.findByRole("button", { name: "Big Corp — Orders → ORD-001" });
    fireEvent.click(label);
    expect(props.onEdgeClick).toHaveBeenCalledWith("c-1->orders->o-1");
  });

  it("opens a node menu from props and runs the selected item", async () => {
    const onSelect = vi.fn();
    renderGraph({
      nodeMenu: {
        nodeId: "o-1",
        title: "ORD-001",
        items: [
          { id: "view", label: "View", onSelect },
          { id: "delete", label: "Delete", destructive: true, onSelect: vi.fn() },
        ],
      },
    });
    const menu = await screen.findByRole("menu", { name: "ORD-001" });
    await userEvent.click(within(menu).getByRole("menuitem", { name: "View" }));
    expect(onSelect).toHaveBeenCalled();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("asks to close the menu on Escape and returns focus to the node", async () => {
    const { props } = renderGraph({
      nodeMenu: {
        nodeId: "o-1",
        title: "ORD-001",
        items: [{ id: "view", label: "View", onSelect: vi.fn() }],
      },
    });
    await screen.findByRole("menu", { name: "ORD-001" });
    await userEvent.keyboard("{Escape}");
    expect(props.onMenuOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens an edge menu anchored to the edge label", async () => {
    renderGraph({
      edgeMenu: {
        edgeId: "c-1->orders->o-1",
        title: "Orders",
        description: "Big Corp → ORD-001",
        items: [{ id: "remove", label: "Remove link", destructive: true, onSelect: vi.fn() }],
      },
    });
    const menu = await screen.findByRole("menu", { name: "Orders" });
    expect(within(menu).getByRole("menuitem", { name: "Remove link" })).toBeInTheDocument();
    expect(screen.getByText("Big Corp → ORD-001")).toBeInTheDocument();
  });

  it("fires onNodeClick when Enter is pressed on a focused node", async () => {
    const { props, container } = renderGraph();
    const nodeEl = container.querySelector<HTMLElement>('.react-flow__node[data-id="o-1"]')!;
    nodeEl.focus();
    expect(document.activeElement).toBe(nodeEl);
    fireEvent.keyDown(nodeEl, { key: "Enter" });
    expect(props.onNodeClick).toHaveBeenCalledWith("o-1");
  });

  it("marks the selected node", () => {
    const { container } = renderGraph({ selectedNodeId: "o-1" });
    const body = container.querySelector('[data-kg-node="o-1"]')!;
    expect(body.className).toContain("ring-2");
  });

  it("renders a self-loop edge without crashing", async () => {
    renderGraph({
      edges: [
        ...edges,
        {
          id: "c-1->self->c-1",
          source: "c-1",
          target: "c-1",
          label: "Colleagues",
          emphasis: "normal",
          ariaLabel: "self",
        },
      ],
    });
    expect(await screen.findByRole("button", { name: "self" })).toBeInTheDocument();
  });
});
