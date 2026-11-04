import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  EntityItemSections,
  type EntityItemSectionsProps,
  hasEntityItemRelations,
} from "../../entity-item-sections";
import { CompactRelationLayout } from "../../relations/relation-layout";
import { useEntityItemContext } from "../../use-entity-item-context";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemCard } from "../item-card/entity-item-card";

/**
 * Side-by-side item detail for an already-loaded item: a card with its attributes and audit trail,
 * and its relations in a fixed-width column of cards (compact relation layout) on the card's
 * right, or below it when there is too little room. An item without relations keeps the single
 * card. Like the other variations it draws no toolbar or page chrome (`h-full min-h-0`, no outer
 * padding) and performs no navigation of its own.
 */
export function EntityItemSideBySide({
  item,
  refetch,
  actions,
  allowEdit = true,
  ...relationHandlers
}: Readonly<EntityItemVariationProps>) {
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);

  const sectionProps: Omit<EntityItemSectionsProps, "item"> = {
    profiles: loadedProfiles,
    state: itemContext.sections,
    editedItem: itemContext.editedItem,
    onEditingChange: itemContext.setIsEditing,
    onRefresh: () => void itemContext.refresh(),
    allowEdit,
    ...relationHandlers,
  };

  if (!hasEntityItemRelations(item)) {
    return (
      <div className="h-full min-h-0">
        <EntityItemCard item={item} actions={actions}>
          <EntityItemSections item={item} {...sectionProps} />
        </EntityItemCard>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      {/* A container query rather than a measured breakpoint: only the classes change, so the
          sections (and an open update form) stay mounted when the column moves below the card. */}
      <div className="@container">
        <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start">
          <div className="min-w-0 flex-1">
            <EntityItemCard item={item} actions={actions}>
              <EntityItemSections item={item} {...sectionProps} show="details" />
            </EntityItemCard>
          </div>
          <CompactRelationLayout>
            <section aria-label="Relations" className="@3xl:w-96 @3xl:shrink-0">
              <EntityItemSections
                item={item}
                {...sectionProps}
                show="relations"
                relationVariant="card"
              />
            </section>
          </CompactRelationLayout>
        </div>
      </div>
    </div>
  );
}
