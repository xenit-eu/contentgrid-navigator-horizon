# Contract: `KnowledgeGraph` ui pattern

**Package**: `packages/ui` — `src/patterns/knowledge-graph/` — exported from `@contentgrid/ui`.
**Owns**: the only import of `@xyflow/react@12.11.6` in the repo; layout; edge geometry; menus.
**Knows nothing about**: HAL, navigator-data, entity items, relations (Principle III). Every value
is a string, number, boolean or callback. Types from [data-model.md §5](../data-model.md#5-ui-pattern-contract-types-plain-props--packagesui).

## Component

```ts
interface KnowledgeGraphProps {
  nodes: readonly KnowledgeGraphNode[];
  edges: readonly KnowledgeGraphEdge[];
  /** Node currently shown in the details panel (visual selection ring). */
  selectedNodeId?: string | null;
  /** Node the layout centres on; changing it triggers relayout + animated fitView. */
  focusNodeId: string;
  /** Ordered ids from root to focus (layout places older ones on the trail line). */
  trailNodeIds: readonly string[];

  onNodeClick(nodeId: string): void; // item or overflow
  onEdgeClick(edgeId: string): void;
  onPaneClick?(): void;

  /** Menus: the consumer decides content; the pattern owns anchoring, focus, Escape, outside click. */
  nodeMenu?: { nodeId: string; title: string; items: readonly KnowledgeGraphMenuItem[] } | null;
  edgeMenu?: {
    edgeId: string;
    title: string; // e.g. "supplier"
    description?: string; // e.g. "INV-001 → ACME"
    items: readonly KnowledgeGraphMenuItem[];
    /** Optional slot for an inline error (feature passes a <ProblemAlert/>). */
    footer?: React.ReactNode;
  } | null;
  onMenuOpenChange(open: boolean): void;

  /** Localisable a11y strings (React Flow ariaLabelConfig + own labels). */
  labels?: Partial<KnowledgeGraphLabels>;
  className?: string;
}
```

## Behaviour guarantees

- **Rendering**: `ReactFlow` with `nodesDraggable={false}`, `nodesConnectable={false}`,
  `elementsSelectable`, `nodesFocusable`, `edgesFocusable`, `fitView`, `minZoom 0.3`, `colorMode`
  derived from the app theme (next-themes), `proOptions` untouched (attribution shown per MIT
  terms/default). `Controls` (zoom in/out/fit) rendered; no minimap.
- **Styling**: `@xyflow/react/dist/base.css` imported once from `src/styles/preset.css` in
  `layer(base)`; `--xy-*` variables mapped to shadcn tokens (background, border, foreground, ring).
  Node colour applied like `IconBadge` (`color-mix(in oklch, <color> 30%, transparent)` fill,
  solid border for `focus`).
- **Node types**: `item` (icon badge + truncated label + sublabel, full text in tooltip, ring when
  selected, thicker border for focus, dashed for trail-only) and `overflow` (pill "+ N more",
  `~` prefix and "estimated" sr-text when estimated).
- **Edge type**: `relation` — straight for single edges, quadratic offset for parallel edges,
  arc for self-loops (R4); arrowhead marker at target (FR-005); label via `EdgeLabelRenderer`
  (clickable, `nodrag nopan`); trail edges emphasised; `status: "loading" | "error"` renders a
  spinner / warning glyph on the label.
- **Layout**: pure `radialLayout({ nodes, edges, focusNodeId, trailNodeIds, previous })` →
  `Record<nodeId, {x, y}>`, deterministic; previous positions reused for surviving nodes (R3).
  Exported for unit tests (not from the package barrel).
- **Menus**: rendered in a Radix `Popover` anchored to the clicked node / edge label DOM element;
  opened by click or Enter/Space on the focused element; closes on Escape, outside click, or
  `nodeMenu/edgeMenu = null`; focus returns to the originating element. Items are a `role="menu"`
  list; `destructive` items styled `variant="destructive"`.
- **Clicks**: `onNodeClick` fires before the consumer sets `nodeMenu` (spec: one click = select +
  menu). The pattern never performs navigation or mutations.
- **Accessibility**: `ariaLabelConfig` populated from `labels`; each node/edge `aria-label` from its
  `ariaLabel`; the canvas has `role="application"` with an `aria-describedby` usage hint.
- **Performance**: ≤ 50 nodes; relayout synchronous; no re-render of unchanged nodes (memoised
  node components, stable `nodeTypes`/`edgeTypes` objects).

## Stories / tests

- `knowledge-graph.stories.tsx`: `Default` (focus + 3 relations), `ParallelAndSelfLoop`,
  `Overflow` (exact + estimated), `TrailCollapsed`, `LoadingAndErrorEdges`, `Dark`,
  `WithInteraction` (click node → menu → Escape; click edge → menu), each with Playwright visual
  baseline except `WithInteraction`.
- `radial-layout.test.ts`: determinism, stability across focus change, no overlapping positions for
  50 nodes, self-loop/parallel handling.
- `knowledge-graph.test.tsx` (jsdom + `mockReactFlow`): renders labels, fires callbacks, menu
  open/close/Escape, focus return.
