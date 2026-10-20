import {
  type ExpansionKey,
  type GraphItemRef,
  expansionKey,
  graphEdgeId,
  graphNodeId,
  sameRef,
} from "./graph-ids";

/** One visited focus item. `via` = the relation on the previous entry it was reached through. */
export interface TrailEntry extends GraphItemRef {
  readonly via?: string;
}

export type GraphSelection =
  /** The details panel shows this item. */
  | { readonly kind: "node"; readonly ref: GraphItemRef }
  /** The details panel shows the overflow list of `owner.relation`. */
  | { readonly kind: "overflow"; readonly owner: GraphItemRef; readonly relation: string }
  /** The edge menu is open for this edge. */
  | { readonly kind: "edge"; readonly edgeId: string };

export interface GraphState {
  /** Fixed for the lifetime of the view (FR-001). Always equal to `trail[0]`. */
  readonly root: GraphItemRef;
  /** `trail[0]` is the root; the last entry is the current focus item. Never empty. */
  readonly trail: readonly TrailEntry[];
  /** Targets pinned into the graph from an overflow list, per owner relation (FR-016/FR-019). */
  readonly pinned: Readonly<Record<ExpansionKey, readonly GraphItemRef[]>>;
  readonly selected: GraphSelection | null;
  /** The root item itself was deleted from within the graph (FR-031). */
  readonly rootDeleted: boolean;
}

export type GraphAction =
  /**
   * Make `ref` the focus item. If `ref` is already in the trail, the trail is truncated back to
   * it. Otherwise it is appended after `fromIndex` (default: the current focus) — i.e. the trail
   * is truncated to `fromIndex` first, so exploring a target of the *previous* focus replaces the
   * current focus instead of producing a path the relations don't support.
   */
  | {
      readonly type: "explore";
      readonly ref: GraphItemRef;
      readonly via?: string;
      readonly fromIndex?: number;
    }
  | { readonly type: "returnTo"; readonly index: number }
  | { readonly type: "select"; readonly selection: GraphSelection | null }
  | {
      readonly type: "pin";
      readonly owner: GraphItemRef;
      readonly relation: string;
      readonly ref: GraphItemRef;
    }
  /** A relation link `owner.relation → target` was removed on the server. */
  | {
      readonly type: "linkRemoved";
      readonly owner: GraphItemRef;
      readonly relation: string;
      readonly target: GraphItemRef;
    }
  /** An item was deleted on the server. */
  | { readonly type: "itemDeleted"; readonly ref: GraphItemRef }
  /** A trail entry turned out not to exist / not be readable: truncate before it. */
  | { readonly type: "trailEntryUnavailable"; readonly index: number }
  /** Re-initialise from external (URL) state — browser back/forward. */
  | {
      readonly type: "reset";
      readonly root: GraphItemRef;
      readonly trailAfterRoot: readonly TrailEntry[];
    };

function normaliseTrail(root: GraphItemRef, trailAfterRoot: readonly TrailEntry[]): TrailEntry[] {
  const trail: TrailEntry[] = [{ entityName: root.entityName, id: root.id }];
  for (const entry of trailAfterRoot) {
    const existing = trail.findIndex((t) => sameRef(t, entry));
    if (existing >= 0) {
      // A cycle back to an earlier entry is the same as returning to it.
      trail.length = existing + 1;
    } else {
      trail.push(entry);
    }
  }
  return trail;
}

export function initialGraphState(
  root: GraphItemRef,
  trailAfterRoot: readonly TrailEntry[] = [],
): GraphState {
  return {
    root,
    trail: normaliseTrail(root, trailAfterRoot),
    pinned: {},
    selected: null,
    rootDeleted: false,
  };
}

function withoutPinned(
  pinned: GraphState["pinned"],
  predicate: (key: ExpansionKey, ref: GraphItemRef) => boolean,
): GraphState["pinned"] {
  const next: Record<ExpansionKey, readonly GraphItemRef[]> = {};
  for (const [key, refs] of Object.entries(pinned) as [ExpansionKey, readonly GraphItemRef[]][]) {
    const kept = refs.filter((ref) => !predicate(key, ref));
    if (kept.length > 0) next[key] = kept;
  }
  return next;
}

function selectionMentions(selection: GraphSelection | null, ref: GraphItemRef): boolean {
  if (!selection) return false;
  if (selection.kind === "node") return sameRef(selection.ref, ref);
  if (selection.kind === "overflow") return sameRef(selection.owner, ref);
  const nodeId = graphNodeId(ref);
  return selection.edgeId.startsWith(`${nodeId}->`) || selection.edgeId.endsWith(`->${nodeId}`);
}

export function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case "explore": {
      const focus = state.trail[state.trail.length - 1]!;
      const selected: GraphSelection = { kind: "node", ref: action.ref };
      if (sameRef(focus, action.ref)) return { ...state, selected };
      const existing = state.trail.findIndex((t) => sameRef(t, action.ref));
      if (existing >= 0) {
        return { ...state, trail: state.trail.slice(0, existing + 1), selected };
      }
      const from = Math.min(
        Math.max(action.fromIndex ?? state.trail.length - 1, 0),
        state.trail.length - 1,
      );
      const entry: TrailEntry = {
        entityName: action.ref.entityName,
        id: action.ref.id,
        ...(action.via ? { via: action.via } : {}),
      };
      return { ...state, trail: [...state.trail.slice(0, from + 1), entry], selected };
    }

    case "returnTo": {
      if (action.index < 0 || action.index >= state.trail.length) return state;
      return {
        ...state,
        trail: state.trail.slice(0, action.index + 1),
        selected: { kind: "node", ref: state.trail[action.index]! },
      };
    }

    case "select":
      return { ...state, selected: action.selection };

    case "pin": {
      const key = expansionKey(graphNodeId(action.owner), action.relation);
      const current = state.pinned[key] ?? [];
      if (current.some((r) => graphNodeId(r) === graphNodeId(action.ref))) return state;
      return { ...state, pinned: { ...state.pinned, [key]: [...current, action.ref] } };
    }

    case "linkRemoved": {
      const key = expansionKey(graphNodeId(action.owner), action.relation);
      const pinned = withoutPinned(
        state.pinned,
        (k, ref) => k === key && sameRef(ref, action.target),
      );
      // If the removed link is the one the trail walked through, the trail beyond it is gone.
      const brokenAt = state.trail.findIndex(
        (entry, i) =>
          i > 0 &&
          sameRef(entry, action.target) &&
          entry.via === action.relation &&
          sameRef(state.trail[i - 1]!, action.owner),
      );
      const trail = brokenAt > 0 ? state.trail.slice(0, brokenAt) : state.trail;
      const removedEdgeId = graphEdgeId(
        graphNodeId(action.owner),
        action.relation,
        graphNodeId(action.target),
      );
      const selected =
        state.selected?.kind === "edge" && state.selected.edgeId === removedEdgeId
          ? null
          : state.selected;
      return { ...state, pinned, trail, selected };
    }

    case "itemDeleted": {
      const deletedId = graphNodeId(action.ref);
      const pinned = withoutPinned(
        state.pinned,
        (key, ref) => sameRef(ref, action.ref) || key.startsWith(`${deletedId}::`),
      );
      const selected = selectionMentions(state.selected, action.ref) ? null : state.selected;
      if (sameRef(state.root, action.ref)) {
        return {
          ...state,
          trail: state.trail.slice(0, 1),
          pinned: {},
          selected: null,
          rootDeleted: true,
        };
      }
      const index = state.trail.findIndex((t) => sameRef(t, action.ref));
      const trail = index > 0 ? state.trail.slice(0, index) : state.trail;
      return { ...state, trail, pinned, selected };
    }

    case "trailEntryUnavailable": {
      if (action.index <= 0 || action.index >= state.trail.length) return state;
      return { ...state, trail: state.trail.slice(0, action.index) };
    }

    case "reset":
      return {
        ...state,
        root: action.root,
        trail: normaliseTrail(action.root, action.trailAfterRoot),
        rootDeleted: sameRef(state.root, action.root) ? state.rootDeleted : false,
        selected: null,
      };
  }
}

/** The current focus item (last trail entry). */
export function focusOf(state: GraphState): TrailEntry {
  return state.trail[state.trail.length - 1]!;
}
