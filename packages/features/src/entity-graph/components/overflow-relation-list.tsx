import { ArrowLeftIcon, GraphIcon } from "@phosphor-icons/react";
import {
  type EntityItemToManyRelation,
  toProblemDisplayModel,
  useEntityItemToManyRelationInfinite,
} from "@contentgrid/navigator-data";
import { Button, Skeleton } from "@contentgrid/ui";
import { EntityItemReference } from "../../entity-item";
import { ProblemAlert } from "../../problem-details";
import type { GraphItemRef } from "../util/graph-ids";

export interface OverflowRelationListProps {
  /** Display label of the item that owns the relation. */
  readonly ownerLabel: string;
  readonly relation: EntityItemToManyRelation;
  /** Node ids currently drawn in the graph — their "Show in graph" is disabled. */
  readonly visibleNodeIds: ReadonlySet<string>;
  readonly onShowDetails: (ref: GraphItemRef) => void;
  readonly onShowInGraph: (ref: GraphItemRef) => void;
  readonly onBack: () => void;
}

/**
 * Every target of one to-many relation, page by page (FR-017/FR-018): each row can be opened in
 * the details panel or brought into the graph (FR-019).
 */
export function OverflowRelationList({
  ownerLabel,
  relation,
  visibleNodeIds,
  onShowDetails,
  onShowInGraph,
  onBack,
}: Readonly<OverflowRelationListProps>) {
  const query = useEntityItemToManyRelationInfinite(relation);
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.totalItems;
  const title = `${relation.profileRelation.title} of ${ownerLabel}`;

  return (
    <section aria-label={title} className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeftIcon />
        Back to details
      </Button>
      <header>
        <h2 className="text-base font-semibold break-words">{title}</h2>
        {total ? (
          <p className="text-sm text-muted-foreground">
            {total.isEstimated ? "About " : ""}
            {new Intl.NumberFormat().format(total.count)} items
            {total.isEstimated ? " (estimated)" : ""}
          </p>
        ) : null}
      </header>

      {query.isPending ? <Skeleton className="h-24 w-full" /> : null}
      {query.isError ? (
        <ProblemAlert
          model={toProblemDisplayModel(query.error)}
          onRetryClick={() => void query.refetch()}
        />
      ) : null}

      <ul className="space-y-1" aria-label={title}>
        {items.map((item) => {
          const ref: GraphItemRef = { entityName: item.profileEntity.name, id: item.id };
          const inGraph = visibleNodeIds.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <EntityItemReference item={item} onClick={() => onShowDetails(ref)} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={inGraph}
                aria-label={inGraph ? "Already in graph" : "Show in graph"}
                title={inGraph ? "Already in graph" : "Show in graph"}
                onClick={() => onShowInGraph(ref)}
              >
                <GraphIcon />
              </Button>
            </li>
          );
        })}
      </ul>

      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </section>
  );
}
