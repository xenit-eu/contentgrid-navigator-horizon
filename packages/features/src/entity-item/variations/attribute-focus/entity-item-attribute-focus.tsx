import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { EntityCard } from "@contentgrid/ui";
import { useEntityDisplayPreferences } from "../../../preferences";
import { EntityItemSections, useEntityItemSectionsState } from "../../entity-item-sections";
import { useEntityItemContext } from "../../use-entity-item-context";
import { EntityItemRelationSummary } from "../entity-item-relation-summary";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemReference } from "../item-reference/entity-item-reference";

/**
 * App-agnostic item detail: renders an already-loaded item's attributes, relations and audit trail
 * as collapsible sections in one card. It draws no toolbar or page chrome and fills whatever space
 * its parent gives it (`h-full min-h-0`, no outer padding); the view above it owns loading, the
 * toolbar and padding. Relations and content are loaded here by following the item's links. All
 * navigation is supplied by the caller through `onRelationItemClick` — this component performs
 * none itself.
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
}: Readonly<EntityItemVariationProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);
  const sections = useEntityItemSectionsState();
  // The entity's `itemLayout` preference lays out the sections; `"content"` lands here only for an
  // entity without content attributes, or when this variation is picked explicitly.
  const { itemLayout } = useEntityDisplayPreferences(item.profileEntity).preferences;
  const sectionsLayout = itemLayout === "stacked" ? "stacked" : "columns";

  return (
    <div className="h-full min-h-0">
      <EntityCard
        name={item.id}
        flushContent
        heading={
          <div className="space-y-1">
            <EntityItemReference item={item} size="lg" />
            <EntityItemRelationSummary item={item} onRelationClick={sections.reveal} />
          </div>
        }
        action={
          actions && (
            <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          )
        }
      >
        <EntityItemSections
          item={item}
          profiles={loadedProfiles}
          state={sections}
          layout={sectionsLayout}
          editedItem={itemContext.editedItem}
          onEditingChange={itemContext.setIsEditing}
          onRefresh={() => void itemContext.refresh()}
          allowEdit={allowEdit}
          onRelationItemClick={onRelationItemClick}
          onRelationItemCreateNew={onRelationItemCreateNew}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onRequiredRelationClick={onRequiredRelationClick}
        />
      </EntityCard>
    </div>
  );
}
