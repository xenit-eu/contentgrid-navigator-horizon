import { type EntityItem, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { EntityItemAttributes } from "./attributes/entity-item-attributes";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relations/relation-handlers";
import { RelationToManySection } from "./relations/relation-to-many-section";
import { RelationToOneSection } from "./relations/relation-to-one-section";
import { EntityItemReference } from "./variations/entity-item-reference";

export type EntityItemViewProps = RelationProblemHandlers & {
  /** The loaded item (and, through it, its profile). The caller owns loading it. */
  readonly item: EntityItem;
  /**
   * Fired when the user clicks through to a related entity item, from
   * either a to-one or to-many relation section; receives the target
   * entity's profile name and the item's id.
   */
  readonly onRelationItemClick?: RelationItemClickHandler;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
};

/**
 * App-agnostic item detail: renders an already-loaded item's attributes and relations. It draws
 * no toolbar or page chrome and fills whatever space its parent gives it (`h-full min-h-0`, no
 * outer padding); the view above it owns loading, the toolbar and padding. Relations and content
 * are loaded here by following the item's links. All navigation is supplied by the caller through
 * `onRelationItemClick` — this component performs none itself.
 */
export function EntityItemView({
  item,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityItemViewProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

  return (
    <div className="h-full min-h-0">
      <div className="p-4">
        <EntityItemReference item={item} size="lg" />
      </div>

      <div className="space-y-6 p-4 pt-0">
        <EntityItemAttributes item={item} />

        {(item.toOneRelations.length > 0 || item.toManyRelations.length > 0) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Relations</h2>
              {item.toOneRelations.map((rel) => (
                <RelationToOneSection
                  key={rel.name}
                  relation={rel}
                  profiles={loadedProfiles}
                  onItemClick={onRelationItemClick}
                  onCreateNew={onRelationItemCreateNew}
                  onMissingRelationTargetClick={onMissingRelationTargetClick}
                  onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
                />
              ))}
              {item.toManyRelations.map((rel) => (
                <RelationToManySection
                  key={rel.name}
                  relation={rel}
                  profiles={loadedProfiles}
                  onItemClick={onRelationItemClick}
                  onCreateNew={onRelationItemCreateNew}
                  onMissingRelationTargetClick={onMissingRelationTargetClick}
                  onRequiredRelationClick={onRequiredRelationClick}
                  onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
