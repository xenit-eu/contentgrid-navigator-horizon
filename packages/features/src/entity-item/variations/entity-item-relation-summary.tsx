import {
  type EntityItem,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  useEntityItemToManyRelation,
  useEntityItemToOneRelation,
} from "@contentgrid/navigator-data";
import { CountIndicatorChip } from "@contentgrid/ui";

interface EntityItemRelationSummaryProps {
  readonly item: EntityItem;
  /** Fired with the relation's name when its entry is clicked. */
  readonly onRelationClick?: (relationName: string) => void;
  readonly className?: string;
}

/**
 * A one-line quick look at the item's relations: each relation's title with how many items it
 * links. Counts come from the same queries the relation sections use, so they share the cache.
 */
export function EntityItemRelationSummary({
  item,
  onRelationClick,
  className,
}: Readonly<EntityItemRelationSummaryProps>) {
  if (item.toOneRelations.length === 0 && item.toManyRelations.length === 0) return null;

  return (
    <ul
      aria-label="Relations"
      className={["flex flex-wrap gap-1", className].filter(Boolean).join(" ")}
    >
      {item.toOneRelations.map((relation) => (
        <li key={relation.name}>
          <ToOneRelationSummaryEntry relation={relation} onClick={onRelationClick} />
        </li>
      ))}
      {item.toManyRelations.map((relation) => (
        <li key={relation.name}>
          <ToManyRelationSummaryEntry relation={relation} onClick={onRelationClick} />
        </li>
      ))}
    </ul>
  );
}

function ToOneRelationSummaryEntry({
  relation,
  onClick,
}: Readonly<{ relation: EntityItemToOneRelation; onClick?: (relationName: string) => void }>) {
  const linkedItem = useEntityItemToOneRelation(relation);
  let count: number | null = null;
  if (linkedItem.isSuccess) count = linkedItem.data === null ? 0 : 1;

  return (
    <RelationSummaryEntry
      title={relation.profileRelation.title ?? relation.name}
      count={count}
      isLoading={linkedItem.isPending}
      onClick={onClick && (() => onClick(relation.name))}
    />
  );
}

function ToManyRelationSummaryEntry({
  relation,
  onClick,
}: Readonly<{ relation: EntityItemToManyRelation; onClick?: (relationName: string) => void }>) {
  const collection = useEntityItemToManyRelation(relation);
  const total = collection.data?.totalItems;

  return (
    <RelationSummaryEntry
      title={relation.profileRelation.title ?? relation.name}
      count={total?.count ?? null}
      isEstimated={total?.isEstimated}
      isLoading={collection.isPending}
      onClick={onClick && (() => onClick(relation.name))}
    />
  );
}

function RelationSummaryEntry({
  title,
  count,
  isEstimated,
  isLoading,
  onClick,
}: Readonly<{
  title: string;
  count: number | null;
  isEstimated?: boolean;
  isLoading: boolean;
  onClick?: () => void;
}>) {
  const content = (
    <>
      <CountIndicatorChip count={count} isEstimated={isEstimated} isLoading={isLoading} />
      {title}
    </>
  );
  const className =
    "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground";

  if (!onClick) return <span className={className}>{content}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]`}
    >
      {content}
    </button>
  );
}
