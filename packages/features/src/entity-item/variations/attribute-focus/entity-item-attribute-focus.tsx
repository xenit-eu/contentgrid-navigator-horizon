import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { EntityItemSections } from "../../entity-item-sections";
import { EntityItemRelationSummary } from "../../relations/relation-summary";
import { useEntityItemContext } from "../../use-entity-item-context";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemCard } from "../item-card/entity-item-card";

/**
 * App-agnostic item detail: renders an already-loaded item's attributes, relations and audit trail
 * as collapsible sections in one card, with a summary of its relations under the item's title. It
 * draws no toolbar or page chrome and fills whatever space its parent gives it (`h-full min-h-0`,
 * no outer padding); the view above it owns loading, the toolbar and padding. Relations and content
 * are loaded here by following the item's links. All navigation is supplied by the caller through
 * `onRelationItemClick` — this component performs none itself.
 */
export function EntityItemAttributeFocus({
  item,
  refetch,
  actions,
  allowEdit = true,
  ...relationHandlers
}: Readonly<EntityItemVariationProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);

  return (
    <div className="h-full min-h-0">
      <EntityItemCard
        item={item}
        actions={actions}
        summary={
          <EntityItemRelationSummary
            item={item}
            onRelationClick={itemContext.sections.revealRelation}
          />
        }
      >
        <EntityItemSections
          item={item}
          profiles={loadedProfiles}
          state={itemContext.sections}
          editedItem={itemContext.editedItem}
          onEditingChange={itemContext.setIsEditing}
          onRefresh={() => void itemContext.refresh()}
          allowEdit={allowEdit}
          {...relationHandlers}
        />
      </EntityItemCard>
    </div>
  );
}
