import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import {
  type EntityItemToManyRelation,
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemRelationTargets,
} from "@contentgrid/navigator-data";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  KnowledgeGraph,
  type KnowledgeGraphEdgeMenu,
  type KnowledgeGraphMenuItem,
  type KnowledgeGraphNodeMenu,
} from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../../app-info-pages";
import type { EntityItemContentFocusViewProps } from "../../entity-item";
import { BreadCrumbsToolBarLayout, PageLayout, RightSidePanelLayout } from "../../layout";
import { useEntityDisplayPreferencesResolver } from "../../preferences";
import { useProfileEntityGate } from "../../util/use-profile-entity-gate";
import { DeleteItemDialog } from "../components/delete-item-dialog";
import { GraphDetailsPanel } from "../components/graph-details-panel";
import { GraphRelationsOutline } from "../components/graph-relations-outline";
import { GraphTrailBreadcrumb } from "../components/graph-trail-breadcrumb";
import { OverflowRelationList } from "../components/overflow-relation-list";
import { RemoveLinkDialog } from "../components/remove-link-dialog";
import { useGraphItems } from "../hooks/use-graph-items";
import {
  type GraphEdgeModel,
  type GraphItemNodeModel,
  buildGraphModel,
} from "../util/build-graph-model";
import { type GraphItemRef, graphEdgeId, graphNodeId, sameRef } from "../util/graph-ids";
import { graphOutlineGroups } from "../util/graph-outline";
import { type TrailEntry, focusOf, graphReducer, initialGraphState } from "../util/graph-state";
import { toKnowledgeGraphProps } from "../util/to-knowledge-graph-props";

type ToolbarOptions = { readonly breadcrumbs?: ReactNode; readonly actions?: ReactNode };

export interface EntityGraphViewProps extends Pick<
  EntityItemContentFocusViewProps,
  | "onMissingRelationTargetClick"
  | "onBlindRelationOverwriteClick"
  | "onRequiredRelationClick"
  | "renderHomeLink"
  | "renderCollectionLink"
> {
  /** Root item: profile entity name + item id (FR-001). Primitive identifiers only. */
  readonly entityName: string;
  readonly itemId: string;
  /** Explored path after the root (from the URL). */
  readonly trail?: readonly TrailEntry[];
  /** Called whenever the explored path changes, so the host can keep the URL in sync (FR-026). */
  readonly onTrailChange?: (trail: readonly TrailEntry[]) => void;
  /** Open an item's regular detail page. */
  readonly onOpenItem: (target: { entityName: string; itemId: string }) => void;
  /** Go to the collection of an entity type (offered after the root item is deleted). */
  readonly onOpenCollection?: (entityName: string) => void;
  /** `undefined` uses the default toolbar; `false` renders no toolbar chrome. */
  readonly toolbar?: ToolbarOptions | false;
}

/**
 * Knowledge-graph view of one item and its relations (spec 007). Resolves everything from
 * primitive identifiers; the host only supplies identifiers, the URL trail and callbacks.
 */
export function EntityGraphView(props: Readonly<EntityGraphViewProps>) {
  const gate = useProfileEntityGate(props.entityName);
  if (gate.status !== "ready") return gate.element;
  return (
    <EntityGraphViewBody
      // A different root is a different graph — start from fresh state.
      key={`${props.entityName}/${props.itemId}`}
      {...props}
      rootProfile={gate.profileEntity}
    />
  );
}

const trailKey = (trail: readonly TrailEntry[]) =>
  JSON.stringify(trail.map((t) => [t.entityName, t.id, t.via ?? null]));

type OpenMenu =
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "edge"; readonly edgeId: string };

function EntityGraphViewBody({
  entityName,
  itemId,
  trail: trailProp = [],
  onTrailChange,
  onOpenItem,
  onOpenCollection,
  toolbar,
  renderHomeLink,
  renderCollectionLink,
  rootProfile,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityGraphViewProps & { rootProfile: ProfileEntity }>) {
  const root = useMemo<GraphItemRef>(() => ({ entityName, id: itemId }), [entityName, itemId]);
  const [state, dispatch] = useReducer(graphReducer, undefined, () =>
    initialGraphState(root, trailProp),
  );
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [removeEdgeId, setRemoveEdgeId] = useState<string | null>(null);
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);
  const [trailNotice, setTrailNotice] = useState(false);

  // --- URL sync (FR-026): external trail → state (back/forward), state → host. ---------------
  const lastSynced = useRef(trailKey(trailProp));
  const externalKey = trailKey(trailProp);
  useEffect(() => {
    if (externalKey !== lastSynced.current) {
      lastSynced.current = externalKey;
      dispatch({ type: "reset", root, trailAfterRoot: trailProp });
      setOpenMenu(null);
    }
    // `trailProp` itself is represented by `externalKey` (a new array each render).
  }, [externalKey, root]);
  useEffect(() => {
    const after = state.trail.slice(1);
    const key = trailKey(after);
    if (key !== lastSynced.current) {
      lastSynced.current = key;
      onTrailChange?.(after);
    }
  }, [state.trail, onTrailChange]);

  // --- Data -------------------------------------------------------------------------------
  const pinnedRefs = Object.values(state.pinned).flat();
  const { items, profiles } = useGraphItems([...state.trail, ...pinnedRefs]);
  const focus = focusOf(state);
  const previous = state.trail.length > 1 ? state.trail[state.trail.length - 2] : undefined;
  const focusItem = items.get(graphNodeId(focus))?.item;
  const previousItem = previous ? items.get(graphNodeId(previous))?.item : undefined;
  const focusRelations = useEntityItemRelationTargets(focusItem);
  const previousRelations = useEntityItemRelationTargets(previousItem, { enabled: !!previous });
  const display = useEntityDisplayPreferencesResolver();

  // A trail entry that no longer exists / isn't readable: cut the trail before it.
  useEffect(() => {
    const index = state.trail.findIndex(
      (entry, i) => i > 0 && items.get(graphNodeId(entry))?.unavailable,
    );
    if (index > 0) {
      dispatch({ type: "trailEntryUnavailable", index });
      setTrailNotice(true);
    }
  }, [state.trail, items]);

  const expansions = new Map([[graphNodeId(focus), focusRelations.relations]]);
  if (previous) expansions.set(graphNodeId(previous), previousRelations.relations);

  const model = buildGraphModel({
    state,
    items,
    expansions,
    display,
    entityTitle: (name) => profiles.find((p) => p.name === name)?.title ?? name,
  });
  const graphProps = toKnowledgeGraphProps(model, state);
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(model.edges.map((e) => [e.id, e]));
  const labelOf = (id: string) => {
    const node = nodeById.get(id);
    return node?.kind === "item" ? node.label : (node?.relationTitle ?? id);
  };

  // --- Interaction ------------------------------------------------------------------------
  const selectNode = (ref: GraphItemRef) =>
    dispatch({ type: "select", selection: { kind: "node", ref } });

  const onNodeClick = (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    if (node.kind === "overflow") {
      setOpenMenu(null);
      dispatch({
        type: "select",
        selection: { kind: "overflow", owner: node.owner, relation: node.relationName },
      });
      return;
    }
    if (node.unavailable) return;
    selectNode(node.ref);
    setOpenMenu({ kind: "node", nodeId });
  };

  const onEdgeClick = (edgeId: string) => {
    if (!edgeById.has(edgeId)) return;
    dispatch({ type: "select", selection: { kind: "edge", edgeId } });
    setOpenMenu({ kind: "edge", edgeId });
  };

  /** Explore a node: from the latest expanded trail item that links to it (FR-012). */
  const explore = (node: GraphItemNodeModel) => {
    const expanded = model.expandedNodeIds;
    const via = model.edges.find(
      (e) => e.target === node.id && !e.toOverflow && expanded.includes(e.source),
    );
    const fromIndex = via ? state.trail.findIndex((t) => graphNodeId(t) === via.source) : undefined;
    dispatch({ type: "explore", ref: node.ref, via: via?.relationName, fromIndex });
    setOpenMenu(null);
  };

  const nodeMenu: KnowledgeGraphNodeMenu | null = (() => {
    if (openMenu?.kind !== "node") return null;
    const node = nodeById.get(openMenu.nodeId);
    if (node?.kind !== "item") return null;
    const items: KnowledgeGraphMenuItem[] = [
      {
        id: "view",
        label: "View",
        onSelect: () => {
          setOpenMenu(null);
          onOpenItem({ entityName: node.ref.entityName, itemId: node.ref.id });
        },
      },
    ];
    if (node.role !== "focus") {
      items.push({ id: "explore", label: "Explore relations", onSelect: () => explore(node) });
    }
    if (node.canDelete) {
      items.push({
        id: "delete",
        label: "Delete",
        destructive: true,
        onSelect: () => {
          setOpenMenu(null);
          setDeleteNodeId(node.id);
        },
      });
    }
    return { nodeId: node.id, title: node.label, description: node.entityTitle, items };
  })();

  const edgeMenu: KnowledgeGraphEdgeMenu | null = (() => {
    if (openMenu?.kind !== "edge") return null;
    const edge = edgeById.get(openMenu.edgeId);
    if (!edge) return null;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const items: KnowledgeGraphMenuItem[] = [];
    if (sourceNode?.kind === "item") {
      items.push({
        id: "select-source",
        label: `Select ${sourceNode.label}`,
        onSelect: () => {
          setOpenMenu(null);
          selectNode(sourceNode.ref);
        },
      });
    }
    if (targetNode?.kind === "item" && !targetNode.unavailable) {
      items.push({
        id: "select-target",
        label: `Select ${targetNode.label}`,
        onSelect: () => {
          setOpenMenu(null);
          selectNode(targetNode.ref);
        },
      });
    }
    if (targetNode?.kind === "overflow") {
      items.push({
        id: "show-all",
        label: `Show all ${edge.relationTitle}`,
        onSelect: () => onNodeClick(targetNode.id),
      });
    }
    if (canRemove(edge)) {
      items.push({
        id: "remove",
        label: "Remove link",
        destructive: true,
        onSelect: () => {
          setOpenMenu(null);
          setRemoveEdgeId(edge.id);
        },
      });
    }
    return {
      edgeId: edge.id,
      title: edge.relationTitle,
      description: `${labelOf(edge.source)} → ${labelOf(edge.target)}`,
      items,
    };
  })();

  // --- Panel ------------------------------------------------------------------------------
  const selection = state.selected;
  const panelRelationClick = (targetEntity: string, targetId: string) =>
    selectNode({ entityName: targetEntity, id: targetId });
  const detailsProps = {
    onOpenItem,
    onRelationItemClick: panelRelationClick,
    onMissingRelationTargetClick,
    onBlindRelationOverwriteClick,
    onRequiredRelationClick,
  };
  let panel: ReactNode;
  if (selection?.kind === "overflow") {
    const ownerItem = items.get(graphNodeId(selection.owner))?.item;
    const relation: EntityItemToManyRelation | undefined = ownerItem?.getToManyRelation(
      selection.relation,
    );
    panel = relation ? (
      <OverflowRelationList
        key={`${selection.owner.id}:${selection.relation}`}
        ownerLabel={labelOf(graphNodeId(selection.owner))}
        relation={relation}
        visibleNodeIds={new Set(model.nodes.map((n) => n.id))}
        onShowDetails={selectNode}
        onShowInGraph={(ref) =>
          dispatch({ type: "pin", owner: selection.owner, relation: selection.relation, ref })
        }
        onBack={() => dispatch({ type: "select", selection: null })}
      />
    ) : null;
  } else {
    const ref = selection?.kind === "node" ? selection.ref : focus;
    panel = (
      <GraphDetailsPanel
        key={graphNodeId(ref)}
        entityName={ref.entityName}
        itemId={ref.id}
        {...detailsProps}
      />
    );
  }

  // --- Dialog targets -----------------------------------------------------------------------
  const removeEdge = removeEdgeId ? edgeById.get(removeEdgeId) : undefined;
  const deleteNode = deleteNodeId ? nodeById.get(deleteNodeId) : undefined;

  // --- Chrome -------------------------------------------------------------------------------
  const rootLabel = labelOf(graphNodeId(root));
  const defaultBreadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {renderHomeLink ? (
            renderHomeLink("Home")
          ) : (
            <span className="text-sm text-muted-foreground">Home</span>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {renderCollectionLink ? (
            renderCollectionLink(rootProfile.name, rootProfile.pluralName)
          ) : (
            <span className="text-sm text-muted-foreground">{rootProfile.pluralName}</span>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{rootLabel} — graph</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  const rootLoad = items.get(graphNodeId(root));
  let body: ReactNode;
  if (state.rootDeleted) {
    body = (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <TrashIcon className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-lg font-semibold">This item was deleted</p>
        {onOpenCollection ? (
          <Button type="button" onClick={() => onOpenCollection(entityName)}>
            Back to {rootProfile.pluralName}
          </Button>
        ) : null}
      </div>
    );
  } else if (rootLoad?.status === "error") {
    body = (
      <ErrorPage model={toProblemDisplayModel(rootLoad.error ?? "This item is not available.")} />
    );
  } else if (!rootLoad?.item) {
    body = <LoadingPage />;
  } else {
    const failing = model.relationStatus.filter((s) => s.status === "error");
    const focusHasNoRelations =
      !!focusItem && focusItem.toOneRelations.length + focusItem.toManyRelations.length === 0;
    const focusNodeId = graphNodeId(focus);
    body = (
      <RightSidePanelLayout
        sidePanelTitle="Details"
        sidePanel={panel}
        // Next to the app sidebar, a 360px panel leaves the canvas too narrow below ~1100px:
        // start collapsed there (one click opens it; it stacks below the graph under 800px).
        defaultSidePanelOpen={panelOpenByDefault()}
      >
        <div className="flex h-full min-h-[480px] flex-col gap-2">
          <GraphTrailBreadcrumb
            entries={state.trail.map((entry, index) => ({
              id: graphNodeId(entry),
              label: labelOf(graphNodeId(entry)),
              viaTitle:
                entry.via && index > 0
                  ? (edgeById.get(
                      graphEdgeId(
                        graphNodeId(state.trail[index - 1]!),
                        entry.via,
                        graphNodeId(entry),
                      ),
                    )?.relationTitle ?? entry.via)
                  : undefined,
            }))}
            onReturn={(index) => {
              setOpenMenu(null);
              dispatch({ type: "returnTo", index });
            }}
          />
          {trailNotice ? (
            <Alert tone="warning">
              <AlertDescription>Some items in this path are no longer available.</AlertDescription>
            </Alert>
          ) : null}
          {failing.length > 0 ? (
            <Alert tone="error">
              <AlertTitle>Some relations could not be loaded</AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {failing.map((s) => (
                    <li key={`${s.owner.id}:${s.relationName}`} className="flex items-center gap-2">
                      <span>
                        Couldn&apos;t load {s.relationTitle} of {labelOf(graphNodeId(s.owner))}.
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={s.retry}>
                        Retry
                      </Button>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {focusHasNoRelations ? (
            <p className="text-sm text-muted-foreground">This item has no relations.</p>
          ) : null}
          <div className="min-h-0 flex-1 rounded-lg border">
            <KnowledgeGraph
              nodes={graphProps.nodes}
              edges={graphProps.edges.map((edge) => ({
                ...edge,
                status: model.relationStatus.some(
                  (s) =>
                    s.status === "pending" &&
                    edge.id.startsWith(`${s.owner.id}->${s.relationName}->`),
                )
                  ? "loading"
                  : undefined,
              }))}
              focusNodeId={graphProps.focusNodeId}
              trailNodeIds={graphProps.trailNodeIds}
              selectedNodeId={graphProps.selectedNodeId}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={() => setOpenMenu(null)}
              nodeMenu={nodeMenu}
              edgeMenu={edgeMenu}
              onMenuOpenChange={(open) => !open && setOpenMenu(null)}
              labels={{
                graph: `Relations graph of ${labelOf(focusNodeId)}`,
                nodeDescription: "Press Enter to show this item's details and actions.",
                edgeDescription: "Press Enter to show this relation link's actions.",
              }}
            />
          </div>
          <GraphRelationsOutline
            focusLabel={labelOf(focusNodeId)}
            groups={graphOutlineGroups(model, focusNodeId)}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
          />
        </div>
      </RightSidePanelLayout>
    );
  }

  const dialogs = (
    <>
      {removeEdge?.relation ? (
        <RemoveLinkDialog
          key={removeEdge.id}
          {...(removeEdge.relation.profileRelation.isToMany
            ? {
                relation: removeEdge.relation as EntityItemToManyRelation,
                target: removeEdge.targetItem!,
              }
            : { relation: removeEdge.relation as never })}
          sourceLabel={labelOf(removeEdge.source)}
          targetLabel={labelOf(removeEdge.target)}
          open
          onOpenChange={(open) => !open && setRemoveEdgeId(null)}
          onRemoved={() =>
            dispatch({
              type: "linkRemoved",
              owner: removeEdge.owner,
              relation: removeEdge.relationName,
              target: removeEdge.targetRef ?? { entityName: "", id: removeEdge.target },
            })
          }
        />
      ) : null}
      {deleteNode?.kind === "item" && deleteNode.item ? (
        <DeleteItemDialog
          key={deleteNode.id}
          item={deleteNode.item}
          label={deleteNode.label}
          open
          onOpenChange={(open) => !open && setDeleteNodeId(null)}
          onDeleted={() => {
            if (sameRef(deleteNode.ref, root)) setOpenMenu(null);
            dispatch({ type: "itemDeleted", ref: deleteNode.ref });
          }}
        />
      ) : null}
    </>
  );

  if (toolbar === false) {
    return (
      <PageLayout>
        {body}
        {dialogs}
      </PageLayout>
    );
  }
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={toolbar?.breadcrumbs ?? defaultBreadcrumbs}
      actions={toolbar?.actions}
    >
      {body}
      {dialogs}
    </BreadCrumbsToolBarLayout>
  );
}

function panelOpenByDefault(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  const wide = window.matchMedia("(min-width: 1100px)").matches;
  const stacked = !window.matchMedia("(min-width: 800px)").matches;
  return wide || stacked;
}

/** Remove-link is offered only when permitted and the mutation has what it needs. */
function canRemove(edge: GraphEdgeModel): boolean {
  if (!edge.canRemove || edge.toOverflow || !edge.relation) return false;
  return edge.relation.profileRelation.isToMany ? !!edge.targetItem : true;
}
