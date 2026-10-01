# Data Model: Entity Knowledge Graph

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All models are client-side, in-memory. Nothing is persisted except the trail in the URL
(FR-026). Server-side data (items, relations, counts, templates) is read exclusively through
`@contentgrid/navigator-data` accessors; the types below reference those accessors, never raw HAL.

Layering: §1–§4 live in `packages/features/src/entity-graph/util/` (pure, no JSX, no ui import).
§5 is the plain-props contract of the ui pattern (`packages/ui/src/patterns/knowledge-graph/`) —
it carries no HAL or navigator-data types.

## 1. Node reference & identity

```ts
/** Identifies an item well enough to fetch it and key it. */
interface GraphItemRef {
  entityName: string; // ProfileEntity.name of the item's type
  id: string; // EntityItem.id — never parsed from an href
}

/** The one place node keys are computed (R5). */
function graphNodeId(ref: GraphItemRef): string; // = ref.id
function overflowNodeId(owner: GraphItemRef, relationName: string): string; // `overflow:${id}:${rel}`
```

## 2. Graph navigation state (`graph-state.ts`)

```ts
interface TrailEntry extends GraphItemRef {
  /** Relation on the previous trail entry through which this item was reached; absent for root. */
  via?: string;
}

interface GraphState {
  root: GraphItemRef; // fixed for the lifetime of the view (FR-001)
  trail: readonly TrailEntry[]; // trail[0] === root; last entry = current focus
  /** Targets pinned from an overflow list, per expansion (FR-016, FR-019b). */
  pinned: Readonly<Record<ExpansionKey, readonly GraphItemRef[]>>;
  selected: GraphSelection | null;
  rootDeleted: boolean;
}

type ExpansionKey = `${string}::${string}`; // `${ownerNodeId}::${relationName}`

type GraphSelection =
  | { kind: "node"; ref: GraphItemRef } // details panel shows item
  | { kind: "overflow"; owner: GraphItemRef; relation: string } // panel shows overflow list
  | { kind: "edge"; edgeId: string }; // edge menu open
```

**Actions / transitions** (reducer `graphReducer(state, action)`):

| Action                              | Precondition             | Effect                                                                                                                                                                                       |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `explore(ref, via)`                 | ref visible, ref ≠ focus | If ref already in trail at index i → truncate trail to i+1 (same as `returnTo`); else append `{...ref, via}`. Selection → node ref.                                                          |
| `returnTo(index)`                   | 0 ≤ index < trail.length | Truncate trail to index+1.                                                                                                                                                                   |
| `select(selection)`                 | —                        | Set `selected`. Does not change trail/layout (FR-010).                                                                                                                                       |
| `pin(owner, relation, ref)`         | ref not already pinned   | Append to `pinned[key]` (dedup by node id).                                                                                                                                                  |
| `linkRemoved(owner, relation, ref)` | mutation succeeded       | Remove ref from `pinned[key]`; if `trail` contains ref _reached via that relation from owner_, truncate trail before it. Selection cleared if it pointed at the removed edge.                |
| `itemDeleted(ref)`                  | mutation succeeded       | Remove ref from all `pinned`; if ref is root → `rootDeleted = true`; else if ref in trail at i → truncate trail to i (focus moves to previous entry, FR-031). Clear selection if it was ref. |

Invariants: `trail.length ≥ 1`; `trail[0]` equals `root`; no two consecutive trail entries are
equal; the reducer never produces URLs.

URL mapping (R11): `trail` ⇄ search param `trail: { e: string; id: string; via?: string }[]`
(excluding root, which comes from path params). Invalid entries are dropped by the validator;
an entry whose item turns out not to exist/readable truncates the trail at that point.

## 3. Relation expansion (input from navigator-data)

Produced by `useEntityItemRelationTargets(entityItem)` (see
[contracts/navigator-data-hooks.md](./contracts/navigator-data-hooks.md)), one per relation the
item exposes:

```ts
type RelationTargets =
  | {
      kind: "to-one";
      relation: EntityItemToOneRelation;
      targetProfile: ProfileEntity | undefined;
      status: "pending" | "error" | "success";
      error: Error | null;
      target: EntityItem | null | undefined; // null = empty slot (FR-006)
      refetch(): void;
    }
  | {
      kind: "to-many";
      relation: EntityItemToManyRelation;
      targetProfile: ProfileEntity | undefined;
      status: "pending" | "error" | "success";
      error: Error | null;
      collection: EntityItemCollection | undefined; // first page, server default size
      refetch(): void;
    };
```

An `Expansion` (feature util) is `{ owner: EntityItem; relations: RelationTargets[] }` for each of
the ≤2 expanded focus items.

## 4. Graph model (`build-graph-model.ts`)

`buildGraphModel(input): GraphModel` — pure; input = `GraphState`, the ≤2 `Expansion`s, the trail
items (`EntityItem | undefined` per trail entry), pinned items, and a display resolver
`(profile) => { color?: string; icon: string; nameAttribute?: ProfileAttribute }`.

```ts
interface GraphModel {
  nodes: GraphNodeModel[];
  edges: GraphEdgeModel[];
  /** Relation groups whose load is pending/failed, for per-relation indicators (FR-027). */
  relationStatus: RelationStatusModel[];
  truncated: boolean; // node budget forced extra collapsing (debug/telemetry, and a11y hint)
}

type GraphNodeModel =
  | {
      kind: "item";
      id: string; // graphNodeId
      ref: GraphItemRef;
      item: EntityItem | undefined; // undefined while loading / unavailable
      label: string; // entityItemLabel(item, nameAttribute) — plain string (R9)
      entityTitle: string; // profileEntity.title
      color: string | undefined; // user preference colour (FR-009), undefined → default
      icon: string;
      role: "focus" | "previous-focus" | "trail" | "target";
      unavailable: boolean; // to-one target not readable (edge case)
      canDelete: boolean; // entityItem.canDelete (FR-029)
    }
  | {
      kind: "overflow";
      id: string; // overflowNodeId
      owner: GraphItemRef;
      relationName: string;
      relationTitle: string;
      remaining: number | null; // null = unknown count but hasNext
      isEstimated: boolean; // FR-008
      color: string | undefined; // target profile colour
    };

interface GraphEdgeModel {
  id: string; // `${sourceId}->${relationName}->${targetId}`
  source: string;
  target: string; // node ids; self-loop when equal
  relationName: string;
  relationTitle: string; // ProfileRelation.title (FR-004)
  cardinality: "to-one" | "to-many";
  onTrail: boolean; // edge along the trail (kept for collapsed items, FR-013)
  toOverflow: boolean;
  /** Remove-link capability (FR-021): to-one → relation.canClear, to-many → relation.canUnlinkItem. */
  canRemove: boolean;
  /** Back-references needed to run the mutation. */
  owner: GraphItemRef;
  targetRef?: GraphItemRef;
}
```

**Validation / rules applied by `buildGraphModel`:**

1. Expanded set = last 2 trail entries (FR-015). Older entries contribute only their node + the
   `onTrail` edge to their successor.
2. Per expanded item, per relation: to-one → 0 or 1 target (FR-006); to-many →
   `items.slice(0, perRelationCap)` + pinned targets (dedup) + overflow node iff
   `remaining > 0 || (totalItems absent && hasNext)` (FR-007/008).
   `remaining = max(0, totalItems.count − shownFromPage)` — pinned targets that also appear in the
   first page are not double-subtracted; count never negative.
3. Nodes dedup by id (FR-002); multiple edges between the same pair are kept, each with its own
   relation title (acceptance 1.5); self-relations become self-loop edges.
4. Budget ≤ 50 nodes (FR-015, SC-002): if exceeded, collapse the previous focus's expansion to
   trail-only; if the current focus alone still exceeds, lower `perRelationCap` uniformly
   (min 1) until it fits; overflow counts grow correspondingly; `truncated = true`.
5. Roles: last trail entry `focus`, second-to-last `previous-focus`, other trail entries `trail`,
   everything else `target`.

## 5. UI pattern contract types (plain props — `packages/ui`)

Mapping from §4 is done by a feature util (`toKnowledgeGraphProps`) so ui never sees accessors:

```ts
interface KnowledgeGraphNode {
  id: string;
  kind: "item" | "overflow";
  label: string; // item: display name; overflow: "+ 15 more" / "+ ~1 240 more"
  sublabel?: string; // entity type title / relation title
  color?: string; // any CSS colour; default var(--muted-foreground)
  icon?: string; // resolved by ui's resolveEntityIcon
  emphasis: "focus" | "previous-focus" | "trail" | "normal";
  muted?: boolean; // unavailable / loading
  ariaLabel: string;
}

interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string; // relation title
  emphasis: "trail" | "normal";
  status?: "loading" | "error";
  ariaLabel: string;
}

interface KnowledgeGraphMenuItem {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect(): void;
}
```

Full component props: [contracts/ui-knowledge-graph-pattern.md](./contracts/ui-knowledge-graph-pattern.md).

## 6. Overflow list

`useEntityItemToManyRelationInfinite(relation)` → pages of `EntityItemCollection`;
the list shows `pages.flatMap(p => p.items)`, header = relation title + owner label + total
(`isEstimated` → "~"), "Load more" while `hasNextPage` (FR-017/018). Per row: "Details"
(select node), "Show in graph" (`pin`; disabled when already visible).
