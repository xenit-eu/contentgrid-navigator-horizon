import { EntityItemSections } from "../../entity-item-sections";
import { EntityItemRelationSummary } from "../../relations/relation-summary";
import { useEntityItemSectionProps } from "../../use-entity-item-section-props";
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
  actions,
  ...props
}: Readonly<EntityItemVariationProps>) {
  const { item } = props;
  const sectionProps = useEntityItemSectionProps(props);

  return (
    <div className="h-full min-h-0">
      <EntityItemCard
        item={item}
        actions={actions}
        summary={
          <EntityItemRelationSummary
            item={item}
            onRelationClick={sectionProps.state.revealRelation}
          />
        }
      >
        <EntityItemSections {...sectionProps} />
      </EntityItemCard>
    </div>
  );
}
