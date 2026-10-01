import { type EntityItem, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { EntityItemAttributes } from "../attributes/entity-item-attributes";
import type {
  MutationErrorDisplayProps,
  RelationItemClickHandler,
} from "../relations/relation-shared";
import { RelationToManySection } from "../relations/relation-to-many-section";
import { RelationToOneSection } from "../relations/relation-to-one-section";

export type EntityItemDetailsBodyProps = Pick<
  MutationErrorDisplayProps,
  "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
> & {
  readonly entityItem: EntityItem;
  /** Fired when the user clicks through to a related item (target entity name + item id). */
  readonly onRelationItemClick?: RelationItemClickHandler;
};

/**
 * An entity item's attributes followed by its relation sections — the shared body of the item
 * detail view, the content-focus side panel and the knowledge-graph details panel.
 */
export function EntityItemDetailsBody({
  entityItem,
  onRelationItemClick,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityItemDetailsBodyProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const hasRelations =
    entityItem.toOneRelations.length > 0 || entityItem.toManyRelations.length > 0;

  return (
    <div className="space-y-6">
      <EntityItemAttributes item={entityItem} />
      {hasRelations && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Relations</h2>
            {entityItem.toOneRelations.map((relation) => (
              <RelationToOneSection
                key={relation.name}
                relation={relation}
                profiles={loadedProfiles}
                onItemClick={onRelationItemClick}
                onMissingRelationTargetClick={onMissingRelationTargetClick}
                onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
              />
            ))}
            {entityItem.toManyRelations.map((relation) => (
              <RelationToManySection
                key={relation.name}
                relation={relation}
                profiles={loadedProfiles}
                onItemClick={onRelationItemClick}
                onMissingRelationTargetClick={onMissingRelationTargetClick}
                onRequiredRelationClick={onRequiredRelationClick}
                onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
