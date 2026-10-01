import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { Button, Skeleton } from "@contentgrid/ui";
import {
  EntityItemDetailsBody,
  type EntityItemDetailsBodyProps,
  EntityItemReference,
} from "../../entity-item";
import { ProblemAlert } from "../../problem-details";

export type GraphDetailsPanelProps = Pick<
  EntityItemDetailsBodyProps,
  | "onRelationItemClick"
  | "onMissingRelationTargetClick"
  | "onBlindRelationOverwriteClick"
  | "onRequiredRelationClick"
> & {
  readonly entityName: string;
  readonly itemId: string;
  /** Open the item's regular detail page (FR-011). */
  readonly onOpenItem: (target: { entityName: string; itemId: string }) => void;
};

/** Details of the item selected in the graph, shown next to it (FR-010, FR-011). */
export function GraphDetailsPanel(props: Readonly<GraphDetailsPanelProps>) {
  const { data: profileEntity } = useProfileEntity({ name: props.entityName });
  if (!profileEntity) return <Skeleton className="h-10 w-full" />;
  return <GraphDetailsPanelBody {...props} profileEntity={profileEntity} />;
}

function GraphDetailsPanelBody({
  entityName,
  itemId,
  onOpenItem,
  profileEntity,
  ...bodyProps
}: Readonly<GraphDetailsPanelProps & { profileEntity: ProfileEntity }>) {
  const item = useEntityItem({ profileEntity, entityId: itemId });

  return (
    <section aria-label="Item details" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.data ? (
            <EntityItemReference item={item.data} size="default" />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenItem({ entityName, itemId })}
        >
          <ArrowSquareOutIcon />
          Open item page
        </Button>
      </div>
      {item.isError ? <ProblemAlert model={toProblemDisplayModel(item.error)} /> : null}
      {item.data ? <EntityItemDetailsBody entityItem={item.data} {...bodyProps} /> : null}
    </section>
  );
}
