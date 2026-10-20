import type { ReactNode } from "react";
import { ArrowSquareOutIcon, CrosshairIcon } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import {
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@contentgrid/ui";
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
  | "onRelationExpand"
> & {
  readonly entityName: string;
  readonly itemId: string;
  /** Open the item's regular detail page (FR-011). */
  readonly onOpenItem: (target: { entityName: string; itemId: string }) => void;
  /** Restart the graph on this item. Omit to hide the action. */
  readonly onOpenGraph?: (target: { entityName: string; itemId: string }) => void;
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
  onOpenGraph,
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
        <TooltipProvider>
          <div className="flex shrink-0 items-center gap-1">
            {onOpenGraph && (
              <PanelIconButton
                label="Center in graph"
                onClick={() => onOpenGraph({ entityName, itemId })}
              >
                <CrosshairIcon />
              </PanelIconButton>
            )}
            <PanelIconButton
              label="Open item page"
              onClick={() => onOpenItem({ entityName, itemId })}
            >
              <ArrowSquareOutIcon />
            </PanelIconButton>
          </div>
        </TooltipProvider>
      </div>
      {item.isError ? <ProblemAlert model={toProblemDisplayModel(item.error)} /> : null}
      {/* The body's rows run edge to edge: cancel the side panel's own padding around them. */}
      {item.data ? (
        <div className="-mx-3 -mb-3">
          <EntityItemDetailsBody entityItem={item.data} {...bodyProps} />
        </div>
      ) : null}
    </section>
  );
}

/** Icon-only action in the panel header; the tooltip carries its accessible name. */
function PanelIconButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
