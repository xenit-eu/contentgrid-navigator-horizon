import { isProblemWithStatus } from "@contentgrid/navigator-data";
import type {
  EntityItem,
  EntityItemToManyRelation,
  EntityItemToOneRelation,
  ProfileAttribute,
  ProfileEntity,
  RelationTargets,
} from "@contentgrid/navigator-data";
import { entityItemLabel } from "./entity-item-label";
import {
  type GraphItemRef,
  expansionKey,
  graphEdgeId,
  graphNodeId,
  overflowNodeId,
  unavailableNodeId,
} from "./graph-ids";
import type { GraphState } from "./graph-state";

/** At most this many targets of one to-many relation are drawn individually (FR-007). */
export const GRAPH_TARGETS_PER_RELATION = 10;
/** Hard cap on visible nodes (FR-015, SC-002). */
export const GRAPH_NODE_BUDGET = 50;

/** Display preferences the model needs per entity type (see `useEntityDisplayPreferencesResolver`). */
export interface GraphDisplay {
  readonly color?: string;
  readonly icon: string;
  readonly nameAttribute?: Pick<ProfileAttribute, "name">;
}

/** Load state of an item the graph fetches itself (trail entries and pinned targets). */
export interface GraphItemLoad {
  readonly item?: EntityItem;
  readonly status: "pending" | "error" | "success";
  /** Not found / not readable by the current user. */
  readonly unavailable: boolean;
  readonly error?: Error | null;
}

export interface BuildGraphModelInput {
  readonly state: GraphState;
  /** Trail and pinned items, keyed by `graphNodeId`. */
  readonly items: ReadonlyMap<string, GraphItemLoad>;
  /** Relation targets of the (≤2) expanded trail items, keyed by the owner's `graphNodeId`. */
  readonly expansions: ReadonlyMap<string, readonly RelationTargets[]>;
  readonly display: (profileEntity: ProfileEntity) => GraphDisplay;
  /** Title of an entity type by name (for nodes whose item isn't loaded yet). */
  readonly entityTitle: (entityName: string) => string;
  readonly perRelationCap?: number;
  readonly nodeBudget?: number;
}

export type GraphNodeRole = "focus" | "previous-focus" | "trail" | "target";

export interface GraphItemNodeModel {
  readonly kind: "item";
  readonly id: string;
  readonly ref: GraphItemRef;
  /** `undefined` while loading or when unavailable. */
  readonly item: EntityItem | undefined;
  readonly label: string;
  readonly entityTitle: string;
  readonly color: string | undefined;
  readonly icon: string | undefined;
  readonly role: GraphNodeRole;
  readonly loading: boolean;
  /** Not readable by the current user (edge case: unreadable to-one target). */
  readonly unavailable: boolean;
  /** `entityItem.canDelete` (FR-029). */
  readonly canDelete: boolean;
}

export interface GraphOverflowNodeModel {
  readonly kind: "overflow";
  readonly id: string;
  readonly owner: GraphItemRef;
  readonly relationName: string;
  readonly relationTitle: string;
  /** `null` = more exist but the server gave no count. Never negative. */
  readonly remaining: number | null;
  readonly isEstimated: boolean;
  readonly color: string | undefined;
}

export type GraphNodeModel = GraphItemNodeModel | GraphOverflowNodeModel;

export interface GraphEdgeModel {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relationName: string;
  readonly relationTitle: string;
  readonly cardinality: "to-one" | "to-many";
  /** The edge the trail walked along (kept visible for collapsed items, FR-013). */
  readonly onTrail: boolean;
  readonly toOverflow: boolean;
  /** Remove-link capability (FR-021): to-one → `canClear`, to-many → `canUnlinkItem`. */
  readonly canRemove: boolean;
  readonly owner: GraphItemRef;
  /** The target item (absent for overflow / unavailable targets). */
  readonly targetRef?: GraphItemRef;
  /** The owner's relation accessor, when the owner item is loaded (needed to run mutations). */
  readonly relation?: EntityItemToOneRelation | EntityItemToManyRelation;
  /** The target item accessor, when known (needed to unlink a to-many target). */
  readonly targetItem?: EntityItem;
}

export interface RelationStatusModel {
  readonly owner: GraphItemRef;
  readonly relationName: string;
  readonly relationTitle: string;
  readonly status: "pending" | "error";
  readonly error: Error | null;
  readonly retry: () => void;
}

export interface GraphModel {
  readonly nodes: readonly GraphNodeModel[];
  readonly edges: readonly GraphEdgeModel[];
  readonly relationStatus: readonly RelationStatusModel[];
  /** Node ids of the trail items whose relations are drawn (≤2). */
  readonly expandedNodeIds: readonly string[];
  /** The node budget forced extra collapsing / a lower per-relation cap. */
  readonly truncated: boolean;
  /** Per-relation cap actually applied. */
  readonly perRelationCap: number;
}

function refOf(item: EntityItem): GraphItemRef {
  return { entityName: item.profileEntity.name, id: item.id };
}

function canRemoveLink(relation: EntityItemToOneRelation | EntityItemToManyRelation): boolean {
  return relation.profileRelation.isToMany
    ? (relation as EntityItemToManyRelation).canUnlinkItem
    : (relation as EntityItemToOneRelation).canClear;
}

/** Mutable accumulator for one build pass. */
class ModelBuilder {
  readonly nodes = new Map<string, GraphNodeModel>();
  readonly edges = new Map<string, GraphEdgeModel>();
  readonly relationStatus: RelationStatusModel[] = [];

  constructor(private readonly input: BuildGraphModelInput) {}

  itemNode(ref: GraphItemRef, item: EntityItem | undefined, role: GraphNodeRole, loading: boolean) {
    const id = graphNodeId(ref);
    const existing = this.nodes.get(id);
    if (existing) return existing;
    const display = item ? this.input.display(item.profileEntity) : undefined;
    const node: GraphItemNodeModel = {
      kind: "item",
      id,
      ref,
      item,
      label: item ? entityItemLabel(item, display?.nameAttribute) : ref.id,
      entityTitle: item ? item.profileEntity.title : this.input.entityTitle(ref.entityName),
      color: display?.color,
      icon: display?.icon,
      role,
      loading,
      unavailable: false,
      canDelete: item?.canDelete ?? false,
    };
    this.nodes.set(id, node);
    return node;
  }

  unavailableNode(owner: GraphItemRef, relationName: string, targetProfile?: ProfileEntity) {
    const id = unavailableNodeId(owner, relationName);
    const entityName = targetProfile?.name ?? "";
    const node: GraphItemNodeModel = {
      kind: "item",
      id,
      ref: { entityName, id },
      item: undefined,
      label: "Unavailable item",
      entityTitle: targetProfile?.title ?? this.input.entityTitle(entityName),
      color: targetProfile ? this.input.display(targetProfile).color : undefined,
      icon: targetProfile ? this.input.display(targetProfile).icon : undefined,
      role: "target",
      loading: false,
      unavailable: true,
      canDelete: false,
    };
    this.nodes.set(id, node);
    return node;
  }

  edge(edge: GraphEdgeModel) {
    const existing = this.edges.get(edge.id);
    if (existing) {
      // Same link reached both via the trail and via an expansion: keep one, flagged on-trail.
      this.edges.set(edge.id, {
        ...existing,
        onTrail: existing.onTrail || edge.onTrail,
        relation: existing.relation ?? edge.relation,
        targetItem: existing.targetItem ?? edge.targetItem,
      });
      return;
    }
    this.edges.set(edge.id, edge);
  }
}

interface BuildPass {
  readonly cap: number;
  readonly expandPrevious: boolean;
}

function buildPass(input: BuildGraphModelInput, pass: BuildPass) {
  const { state, items, expansions } = input;
  const b = new ModelBuilder(input);
  const trail = state.trail;
  const last = trail.length - 1;

  const expandedIndexes = pass.expandPrevious && last >= 1 ? [last, last - 1] : [last];

  // 1. Trail nodes (roles take priority over "target").
  trail.forEach((entry, index) => {
    const load = items.get(graphNodeId(entry));
    let role: GraphNodeRole = "trail";
    if (index === last) role = "focus";
    else if (index === last - 1 && pass.expandPrevious) role = "previous-focus";
    b.itemNode(
      { entityName: entry.entityName, id: entry.id },
      load?.item,
      role,
      !load || load.status === "pending",
    );
  });

  // 2. Trail edges: previous entry --via--> entry.
  trail.forEach((entry, index) => {
    if (index === 0 || !entry.via) return;
    const owner = trail[index - 1]!;
    const ownerItem = items.get(graphNodeId(owner))?.item;
    const relation = ownerItem?.getRelation(entry.via);
    const targetItem = items.get(graphNodeId(entry))?.item;
    b.edge({
      id: graphEdgeId(graphNodeId(owner), entry.via, graphNodeId(entry)),
      source: graphNodeId(owner),
      target: graphNodeId(entry),
      relationName: entry.via,
      relationTitle: relation?.profileRelation.title ?? entry.via,
      cardinality: relation?.profileRelation.isToMany ? "to-many" : "to-one",
      onTrail: true,
      toOverflow: false,
      canRemove: relation ? canRemoveLink(relation) : false,
      owner: { entityName: owner.entityName, id: owner.id },
      targetRef: { entityName: entry.entityName, id: entry.id },
      relation,
      targetItem,
    });
  });

  // 3. Expanded items' relations — current focus first so it wins the node budget.
  for (const index of expandedIndexes) {
    const ownerEntry = trail[index]!;
    const owner: GraphItemRef = { entityName: ownerEntry.entityName, id: ownerEntry.id };
    const ownerId = graphNodeId(owner);
    const relations = expansions.get(ownerId) ?? [];

    for (const rt of relations) {
      const relation = rt.relation;
      const relationTitle = relation.profileRelation.title;
      const cardinality = rt.kind;

      if (rt.status !== "success") {
        const isNoAccess =
          rt.kind === "to-one" &&
          rt.status === "error" &&
          (isProblemWithStatus(rt.error, 403) || isProblemWithStatus(rt.error, 404));
        if (isNoAccess) {
          const node = b.unavailableNode(owner, relation.name, rt.targetProfile);
          b.edge({
            id: graphEdgeId(ownerId, relation.name, node.id),
            source: ownerId,
            target: node.id,
            relationName: relation.name,
            relationTitle,
            cardinality,
            onTrail: false,
            toOverflow: false,
            canRemove: canRemoveLink(relation),
            owner,
            relation,
          });
        } else {
          b.relationStatus.push({
            owner,
            relationName: relation.name,
            relationTitle,
            status: rt.status,
            error: rt.error,
            retry: rt.refetch,
          });
        }
        continue;
      }

      const addTarget = (target: EntityItem | undefined, ref: GraphItemRef, loading: boolean) => {
        const node = b.itemNode(ref, target, "target", loading);
        b.edge({
          id: graphEdgeId(ownerId, relation.name, node.id),
          source: ownerId,
          target: node.id,
          relationName: relation.name,
          relationTitle,
          cardinality,
          onTrail: false,
          toOverflow: false,
          canRemove: canRemoveLink(relation),
          owner,
          targetRef: ref,
          relation,
          targetItem: target,
        });
      };

      if (rt.kind === "to-one") {
        if (rt.target) addTarget(rt.target, refOf(rt.target), false);
        continue;
      }

      const collection = rt.collection;
      const pageItems = collection?.items ?? [];
      const shown = pageItems.slice(0, pass.cap);
      const shownIds = new Set(shown.map((i) => i.id));
      shown.forEach((target) => addTarget(target, refOf(target), false));

      const pinned = state.pinned[expansionKey(ownerId, relation.name)] ?? [];
      const pinnedExtra = pinned.filter((ref) => !shownIds.has(ref.id));
      pinnedExtra.forEach((ref) => {
        const load = items.get(graphNodeId(ref));
        const fromPage = pageItems.find((i) => i.id === ref.id);
        const target = load?.item ?? fromPage;
        addTarget(target, ref, !target && (!load || load.status === "pending"));
      });

      const known =
        collection?.totalItems?.count ?? (collection?.hasNext ? undefined : pageItems.length);
      const remaining =
        known === undefined ? null : Math.max(0, known - shown.length - pinnedExtra.length);
      if (remaining === null || remaining > 0) {
        const id = overflowNodeId(owner, relation.name);
        const targetDisplay = rt.targetProfile ? input.display(rt.targetProfile) : undefined;
        b.nodes.set(id, {
          kind: "overflow",
          id,
          owner,
          relationName: relation.name,
          relationTitle,
          remaining,
          isEstimated: collection?.totalItems?.isEstimated ?? false,
          color: targetDisplay?.color,
        });
        b.edge({
          id: graphEdgeId(ownerId, relation.name, id),
          source: ownerId,
          target: id,
          relationName: relation.name,
          relationTitle,
          cardinality,
          onTrail: false,
          toOverflow: true,
          canRemove: false,
          owner,
          relation,
        });
      }
    }
  }

  return {
    b,
    expandedNodeIds: expandedIndexes.map((i) => graphNodeId(trail[i]!)),
  };
}

/**
 * Builds the visible graph from the navigation state and the loaded data (data-model.md §4):
 *
 * 1. The last 2 trail entries are expanded; older entries show only their node and the trail
 *    edge to their successor (FR-013, FR-015).
 * 2. to-one → 0 or 1 target; to-many → first `perRelationCap` targets of the first page, plus
 *    pinned targets, plus one overflow node while targets remain (FR-006–FR-008).
 * 3. One node per item id; one edge per (owner, relation, target) — parallel relations between
 *    the same pair stay separate edges; self-relations are self-loops (FR-002, FR-004).
 * 4. ≤ `nodeBudget` nodes: collapse the previous focus first; then lower the per-relation cap
 *    (min 1) until it fits. The current focus always stays expanded.
 */
export function buildGraphModel(input: BuildGraphModelInput): GraphModel {
  const budget = input.nodeBudget ?? GRAPH_NODE_BUDGET;
  const maxCap = input.perRelationCap ?? GRAPH_TARGETS_PER_RELATION;

  const attempts: BuildPass[] = [{ cap: maxCap, expandPrevious: true }];
  if (input.state.trail.length >= 2) attempts.push({ cap: maxCap, expandPrevious: false });
  for (let cap = maxCap - 1; cap >= 1; cap--) attempts.push({ cap, expandPrevious: false });

  let result = buildPass(input, attempts[0]!);
  let used = attempts[0]!;
  for (const attempt of attempts.slice(1)) {
    if (result.b.nodes.size <= budget) break;
    result = buildPass(input, attempt);
    used = attempt;
  }

  return {
    nodes: [...result.b.nodes.values()],
    edges: [...result.b.edges.values()],
    relationStatus: result.b.relationStatus,
    expandedNodeIds: result.expandedNodeIds,
    truncated: used !== attempts[0],
    perRelationCap: used.cap,
  };
}
