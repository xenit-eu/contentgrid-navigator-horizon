export interface GraphOutlineTarget {
  readonly nodeId: string;
  readonly edgeId: string;
  readonly label: string;
}

export interface GraphOutlineGroup {
  readonly relationName: string;
  readonly relationTitle: string;
  readonly targets: readonly GraphOutlineTarget[];
  /** "+ N more" entry, when the relation has undrawn targets. */
  readonly overflow?: { readonly nodeId: string; readonly label: string };
}

export interface GraphRelationsOutlineProps {
  readonly focusLabel: string;
  readonly groups: readonly GraphOutlineGroup[];
  readonly onNodeClick: (nodeId: string) => void;
  readonly onEdgeClick: (edgeId: string) => void;
}

/**
 * A plain, keyboard- and screen-reader-first list of the focus item's relations (FR-028). Every
 * action of the canvas (select an item + its menu, a relation link's menu, the full list of a large
 * relation) is reachable from here with ordinary buttons.
 */
export function GraphRelationsOutline({
  focusLabel,
  groups,
  onNodeClick,
  onEdgeClick,
}: Readonly<GraphRelationsOutlineProps>) {
  return (
    <details className="rounded-md border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">
        Relations of {focusLabel} (list view)
      </summary>
      {groups.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No relations to show.</p>
      ) : (
        <ul className="mt-2 space-y-2" aria-label={`Relations of ${focusLabel}`}>
          {groups.map((group) => (
            <li key={group.relationName}>
              <span className="font-medium">{group.relationTitle}</span>
              <ul className="mt-1 ml-4 space-y-1">
                {group.targets.map((target) => (
                  <li key={target.edgeId} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      onClick={() => onNodeClick(target.nodeId)}
                    >
                      {target.label}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      aria-label={`${group.relationTitle} link to ${target.label}: actions`}
                      onClick={() => onEdgeClick(target.edgeId)}
                    >
                      link actions
                    </button>
                  </li>
                ))}
                {group.overflow ? (
                  <li>
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      onClick={() => onNodeClick(group.overflow!.nodeId)}
                    >
                      {group.overflow.label}
                    </button>
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
