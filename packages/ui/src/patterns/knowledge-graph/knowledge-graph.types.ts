import type { ReactNode } from "react";

/**
 * Plain-value view model of one graph node. No domain types: every field is a string, number,
 * boolean or callback, so the pattern stays reusable outside Navigator's data layer.
 */
export interface KnowledgeGraphNode {
  readonly id: string;
  /** `item` = a regular node; `overflow` = a "+ N more" placeholder pill. */
  readonly kind: "item" | "overflow";
  /** Main text (item display name, or "+ 15 more"). Truncated visually; full text in a tooltip. */
  readonly label: string;
  /** Secondary text (entity type / relation name). */
  readonly sublabel?: string;
  /** Any CSS colour. Defaults to `var(--muted-foreground)`, like `IconBadge`. */
  readonly color?: string;
  /** Icon name from `ENTITY_ICON_OPTIONS` (resolved via `resolveEntityIcon`). */
  readonly icon?: string;
  readonly emphasis: "focus" | "previous-focus" | "trail" | "normal";
  /** Rendered dimmed (loading / unavailable). */
  readonly muted?: boolean;
  /** Overflow count is an estimate (announced to assistive technology). */
  readonly estimated?: boolean;
  readonly ariaLabel: string;
}

export interface KnowledgeGraphEdge {
  readonly id: string;
  /** Node ids; `source === target` renders a self-loop. */
  readonly source: string;
  readonly target: string;
  /** Edge label (relation name). */
  readonly label: string;
  readonly emphasis: "trail" | "normal";
  readonly status?: "loading" | "error";
  readonly ariaLabel: string;
}

export interface KnowledgeGraphMenuItem {
  readonly id: string;
  readonly label: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface KnowledgeGraphNodeMenu {
  readonly nodeId: string;
  readonly title: string;
  readonly description?: string;
  readonly items: readonly KnowledgeGraphMenuItem[];
  readonly footer?: ReactNode;
}

export interface KnowledgeGraphEdgeMenu {
  readonly edgeId: string;
  readonly title: string;
  readonly description?: string;
  readonly items: readonly KnowledgeGraphMenuItem[];
  /** Optional slot, e.g. an inline error alert. */
  readonly footer?: ReactNode;
}

/** Localisable strings (also fed to React Flow's `ariaLabelConfig`). */
export interface KnowledgeGraphLabels {
  /** Accessible name of the graph canvas. */
  readonly graph: string;
  /** Usage hint read after the canvas name. */
  readonly usageHint: string;
  readonly nodeDescription: string;
  readonly edgeDescription: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly fitView: string;
  readonly estimated: string;
  readonly loading: string;
  readonly error: string;
}

export interface KnowledgeGraphProps {
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
  /** The node the layout centres on; changing it re-lays out and re-fits the view. */
  readonly focusNodeId: string;
  /** Ordered node ids from the root to the focus (older ones go on the trail line). */
  readonly trailNodeIds: readonly string[];
  /** Node shown in the consumer's details panel (selection ring). */
  readonly selectedNodeId?: string | null;

  readonly onNodeClick: (nodeId: string) => void;
  readonly onEdgeClick: (edgeId: string) => void;
  readonly onPaneClick?: () => void;

  /** Menus: content decided by the consumer; anchoring, Escape and outside-click owned here. */
  readonly nodeMenu?: KnowledgeGraphNodeMenu | null;
  readonly edgeMenu?: KnowledgeGraphEdgeMenu | null;
  readonly onMenuOpenChange?: (open: boolean) => void;

  readonly labels?: Partial<KnowledgeGraphLabels>;
  readonly className?: string;
}
