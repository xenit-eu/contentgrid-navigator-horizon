import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { DeleteEntityItemButton } from "../../../entity-item-delete";
import { EditableEntityItemAttributes } from "../../attributes/editable-entity-item-attributes";
import { EditEntityItemButton } from "../../edit/edit-entity-item-button";
import { RelationToManySection } from "../../relations/relation-to-many-section";
import { RelationToOneSection } from "../../relations/relation-to-one-section";
import { useEntityItemContext } from "../../use-entity-item-context";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemReference } from "../item-reference/entity-item-reference";

/**
 * App-agnostic item detail: renders an already-loaded item's attributes and relations. It draws
 * no toolbar or page chrome and fills whatever space its parent gives it (`h-full min-h-0`, no
 * outer padding); the view above it owns loading, the toolbar and padding. Relations and content
 * are loaded here by following the item's links. All navigation is supplied by the caller through
 * `onRelationItemClick` — this component performs none itself.
 */
export function EntityItemAttributeFocus({
  item,
  refetch,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  actions,
  allowEdit = true,
  onDeleted,
}: Readonly<EntityItemVariationProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);

  return (
    <div className="h-full min-h-0">
      <div className="flex items-center justify-between gap-2 p-4">
        <EntityItemReference item={item} size="lg" />
        <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
          {actions}
          {allowEdit && (
            <EditEntityItemButton
              item={item}
              isEditing={itemContext.isEditing}
              onEdit={() => itemContext.setIsEditing(true)}
            />
          )}
          {onDeleted && !itemContext.isEditing && (
            <DeleteEntityItemButton item={item} onDeleted={onDeleted} />
          )}
        </div>
      </div>

      <div className="space-y-6 p-4 pt-0">
        <EditableEntityItemAttributes
          item={itemContext.shownItem}
          isEditing={itemContext.isEditing}
          onEditingChange={itemContext.setIsEditing}
          onRefresh={() => void itemContext.refresh()}
        />

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
