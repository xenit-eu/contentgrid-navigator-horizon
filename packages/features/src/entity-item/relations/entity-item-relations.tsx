import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relation-handlers";
import { RelationToManySection } from "./relation-to-many-section";
import { RelationToOneSection } from "./relation-to-one-section";

export type EntityItemRelationsProps = RelationProblemHandlers & {
  readonly item: EntityItem;
  readonly profiles: readonly ProfileEntity[];
  readonly onItemClick?: RelationItemClickHandler;
  readonly onCreateNew?: RelationItemCreateHandler;
  /** `false` shows the relations without their edit actions. Defaults to `true`. */
  readonly allowEdit?: boolean;
};

/** The item's to-one and to-many relation sections under a "Relations" heading; nothing when it has no relations. */
export function EntityItemRelations({
  item,
  profiles,
  onItemClick,
  onCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  allowEdit = true,
}: Readonly<EntityItemRelationsProps>) {
  if (item.toOneRelations.length === 0 && item.toManyRelations.length === 0) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Relations</h2>
        {item.toOneRelations.map((relation) => (
          <RelationToOneSection
            key={relation.name}
            relation={relation}
            profiles={profiles}
            onItemClick={onItemClick}
            onCreateNew={onCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            allowEdit={allowEdit}
          />
        ))}
        {item.toManyRelations.map((relation) => (
          <RelationToManySection
            key={relation.name}
            relation={relation}
            profiles={profiles}
            onItemClick={onItemClick}
            onCreateNew={onCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onRequiredRelationClick={onRequiredRelationClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            allowEdit={allowEdit}
          />
        ))}
      </div>
    </>
  );
}
