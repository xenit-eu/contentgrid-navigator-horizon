import type { Meta, StoryObj } from "@storybook/react";
import { KnowledgeGraph } from "./knowledge-graph";
import {
  CUSTOMER,
  ORDER,
  PRODUCT,
  StoryFrame,
  baseArgs,
  defaultEdges,
  defaultNodes,
  edge,
  item,
} from "./knowledge-graph-story-helpers";

const meta = {
  title: "Patterns/KnowledgeGraph",
  component: KnowledgeGraph,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <StoryFrame>
        <Story />
      </StoryFrame>
    ),
  ],
  args: baseArgs,
} satisfies Meta<typeof KnowledgeGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A focus item with a to-many relation (3 targets) and a to-one relation. */
export const Default: Story = {};

/** Two relations between the same pair bend apart; a self-relation is a loop. */
export const ParallelAndSelfLoop: Story = {
  args: {
    nodes: [
      item("alice", "Alice", "Employee", undefined, "focus"),
      item("bob", "Bob", "Employee", undefined),
    ],
    edges: [
      edge("alice", "Boss", "bob"),
      edge("alice", "Colleagues", "bob"),
      edge("alice", "Colleagues", "alice"),
    ],
    focusNodeId: "alice",
    trailNodeIds: ["alice"],
  },
};

/** Exact and estimated overflow placeholders for large to-many relations. */
/** Files held by the focus item, drawn as content nodes next to its relations. */
export const WithContent: Story = {
  args: {
    nodes: [
      ...defaultNodes,
      {
        id: "content:c1:contract",
        kind: "content",
        label: "framework-contract.pdf",
        sublabel: "Contract",
        fileType: "pdf",
        emphasis: "normal",
        ariaLabel: "Contract framework-contract.pdf",
      },
      {
        id: "content:c1:logo",
        kind: "content",
        label: "logo.png",
        sublabel: "Logo",
        fileType: "img",
        emphasis: "normal",
        ariaLabel: "Logo logo.png",
      },
    ],
    edges: [
      ...defaultEdges,
      { ...edge("c1", "Contract", "content:c1:contract"), variant: "content" },
      { ...edge("c1", "Logo", "content:c1:logo"), variant: "content" },
    ],
  },
};

export const Overflow: Story = {
  args: {
    nodes: [
      item("c1", "Big Corp", "Customer", CUSTOMER, "focus"),
      ...Array.from({ length: 10 }, (_, i) =>
        item(`o${i}`, `ORD-${String(i + 1).padStart(3, "0")}`, "Order", ORDER),
      ),
      {
        id: "more-orders",
        kind: "overflow",
        label: "+ ~1,240 more",
        sublabel: "Orders",
        color: ORDER,
        emphasis: "normal",
        estimated: true,
        ariaLabel: "about 1,240 more Orders",
      },
      item("p1", "Widget", "Product", PRODUCT),
      {
        id: "more-products",
        kind: "overflow",
        label: "+ 15 more",
        sublabel: "Favourite products",
        color: PRODUCT,
        emphasis: "normal",
        ariaLabel: "15 more Favourite products",
      },
    ],
    edges: [
      ...Array.from({ length: 10 }, (_, i) => edge("c1", "Orders", `o${i}`)),
      edge("c1", "Orders", "more-orders"),
      edge("c1", "Favourite products", "p1"),
      edge("c1", "Favourite products", "more-products"),
    ],
  },
};

/** root → order → product: the root is collapsed to the trail, the order is still expanded. */
export const TrailCollapsed: Story = {
  args: {
    nodes: [
      item("c1", "Big Corp", "Customer", CUSTOMER, "trail"),
      item("o1", "ORD-001", "Order", ORDER, "previous-focus"),
      item("p1", "Widget", "Product", PRODUCT, "focus"),
      item("p2", "Gadget", "Product", PRODUCT),
      item("s1", "ACME", "Supplier", undefined),
    ],
    edges: [
      edge("c1", "Orders", "o1", "trail"),
      edge("o1", "Products", "p1", "trail"),
      edge("o1", "Products", "p2"),
      edge("o1", "Customer", "c1"),
      edge("p1", "Supplier", "s1"),
    ],
    focusNodeId: "p1",
    trailNodeIds: ["c1", "o1", "p1"],
    selectedNodeId: "p2",
  },
};

/** Per-relation loading and error indicators on the edge labels. */
export const LoadingAndErrorEdges: Story = {
  args: {
    nodes: [
      item("c1", "Big Corp", "Customer", CUSTOMER, "focus"),
      { ...item("o1", "Loading…", "Order", ORDER), muted: true },
      item("a1", "Alice Martens", "Account manager", undefined),
    ],
    edges: [
      edge("c1", "Orders", "o1", "normal", "loading"),
      edge("c1", "Account manager", "a1", "normal", "error"),
    ],
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};
