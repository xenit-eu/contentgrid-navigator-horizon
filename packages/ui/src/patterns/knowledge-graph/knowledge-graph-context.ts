import { createContext, useContext } from "react";
import type { EdgeSiblingInfo } from "./edges/edge-siblings";
import type {
  KnowledgeGraphEdgeMenu,
  KnowledgeGraphLabels,
  KnowledgeGraphNodeMenu,
} from "./knowledge-graph.types";

/** Shared, per-graph state that custom nodes/edges read without prop-drilling through React Flow. */
export interface KnowledgeGraphContextValue {
  readonly selectedNodeId: string | null;
  readonly nodeMenu: KnowledgeGraphNodeMenu | null;
  readonly edgeMenu: KnowledgeGraphEdgeMenu | null;
  readonly onMenuOpenChange: (open: boolean) => void;
  readonly onEdgeClick: (edgeId: string) => void;
  readonly siblings: ReadonlyMap<string, EdgeSiblingInfo>;
  readonly labels: KnowledgeGraphLabels;
}

export const KnowledgeGraphContext = createContext<KnowledgeGraphContextValue | null>(null);

export function useKnowledgeGraphContext(): KnowledgeGraphContextValue {
  const value = useContext(KnowledgeGraphContext);
  if (!value) throw new Error("KnowledgeGraph node/edge rendered outside <KnowledgeGraph>");
  return value;
}
