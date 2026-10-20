import { type EntityItem, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { EntityItemSections, useEntityItemSectionsState } from "../entity-item-sections";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "../relations/relation-handlers";
import { EntityItemRelationSummary } from "../variations/entity-item-relation-summary";

export type EntityItemDetailsBodyProps = RelationProblemHandlers & {
  readonly entityItem: EntityItem;
  /** Fired when the user clicks through to a related item (target entity name + item id). */
  readonly onRelationItemClick?: RelationItemClickHandler;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * Fired when the user expands a relation's row (directly or from the relation summary), with
   * the profile name of the relation's target entity.
   */
  readonly onRelationExpand?: (targetEntityName: string) => void;
};

/**
 * An entity item's relation summary followed by its attributes, relations and audit trail as
 * collapsible rows ({@link EntityItemSections}) — the shared body of the content-focus side panel
 * and the knowledge-graph details panel. The rows run edge to edge, so host it in an unpadded
 * container.
 */
export function EntityItemDetailsBody({
  entityItem,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  onRelationExpand,
}: Readonly<EntityItemDetailsBodyProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const sections = useEntityItemSectionsState({
    onOpen: (section) => {
      const relation = [...entityItem.toOneRelations, ...entityItem.toManyRelations].find(
        (rel) => rel.name === section,
      );
      const target = relation?.profileRelation.getTargetProfile(loadedProfiles);
      if (target) onRelationExpand?.(target.name);
    },
  });

  return (
    <div>
      {/* 18px + the entries' own 6px padding lines the chips up with the rows' 24px gutter. */}
      <EntityItemRelationSummary
        item={entityItem}
        onRelationClick={sections.reveal}
        className="px-[1.125rem] py-2"
      />
      <EntityItemSections
        item={entityItem}
        profiles={loadedProfiles}
        state={sections}
        onRelationItemClick={onRelationItemClick}
        onRelationItemCreateNew={onRelationItemCreateNew}
        onMissingRelationTargetClick={onMissingRelationTargetClick}
        onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
        onRequiredRelationClick={onRequiredRelationClick}
      />
    </div>
  );
}
