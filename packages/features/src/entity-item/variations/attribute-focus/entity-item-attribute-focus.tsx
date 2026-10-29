import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { EntityCard } from "@contentgrid/ui";
import { useEntityDisplayPreferences } from "../../../preferences";
import {
  EntityItemSections,
  type EntityItemSectionsProps,
  hasEntityItemRelations,
  useEntityItemSectionsState,
} from "../../entity-item-sections";
import { CompactRelationLayout } from "../../relations/relation-layout";
import { useEntityItemContext } from "../../use-entity-item-context";
import { EntityItemRelationSummary } from "../entity-item-relation-summary";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemReference } from "../item-reference/entity-item-reference";

/**
 * App-agnostic item detail: renders an already-loaded item's attributes, relations and audit trail
 * as collapsible sections. It draws no toolbar or page chrome and fills whatever space its parent
 * gives it (`h-full min-h-0`, no outer padding); the view above it owns loading, the toolbar and
 * padding. Relations and content are loaded here by following the item's links. All navigation is
 * supplied by the caller through `onRelationItemClick` — this component performs none itself.
 *
 * The entity's `itemLayout` display preference lays out the sections: `"stacked"` lists every
 * section in one card; otherwise (`"columns"`, or `"content"` when this variation renders anyway)
 * the card keeps the attributes and audit trail and the relations move to a fixed-width column of
 * cards in the compact relation layout on its right, or below it when there is too little room. An
 * item without relations keeps the single card.
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
  const { itemLayout } = useEntityDisplayPreferences(item.profileEntity).preferences;

  const sectionProps: Omit<EntityItemSectionsProps, "item"> = {
    profiles: loadedProfiles,
    state: sections,
    editedItem: itemContext.editedItem,
    onEditingChange: itemContext.setIsEditing,
    onRefresh: () => void itemContext.refresh(),
    allowEdit,
    onRelationItemClick,
    onRelationItemCreateNew,
    onMissingRelationTargetClick,
    onBlindRelationOverwriteClick,
    onRequiredRelationClick,
  };
  const relationsPanel = itemLayout !== "stacked" && hasEntityItemRelations(item);

  const card = (
    <EntityCard
      name={item.id}
      flushContent
      heading={
        <div className="space-y-1">
          <EntityItemReference item={item} size="lg" />
          <EntityItemRelationSummary item={item} onRelationClick={sections.revealRelation} />
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
      <EntityItemSections item={item} {...sectionProps} show={relationsPanel ? "details" : "all"} />
    </EntityCard>
  );

  return (
    <div className="h-full min-h-0">
      {relationsPanel ? (
        // A container query rather than a measured breakpoint: only the classes change, so the
        // sections (and an open update form) stay mounted when the column moves below the card.
        <div className="@container">
          <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start">
            <div className="min-w-0 flex-1">{card}</div>
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
      ) : (
        card
      )}
    </div>
  );
}
