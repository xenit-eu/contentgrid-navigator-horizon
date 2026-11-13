import { ResizableSplitLayout } from "@contentgrid/ui";
import { EntityItemSections, hasEntityItemRelations } from "../../entity-item-sections";
import { useEntityItemSectionProps } from "../../use-entity-item-section-props";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemCard } from "../item-card/entity-item-card";

/** Layout width (px) below which the relations pane moves below the card. */
const STACK_BELOW = 768;

/**
 * Side-by-side item detail for an already-loaded item: a card with its attributes and audit trail
 * in the left pane of a `ResizableSplitLayout`, and its relations as a column of cards in the
 * right pane. The user drags the handle between them to resize; each pane scrolls on its own, and
 * the relation sections adapt to the right pane's width (`usePaneWidth()`). Below
 * `STACK_BELOW` the panes stack without a handle: the relations follow the card at their natural
 * height. An item without relations keeps
 * the single card. Like the other variations it draws no toolbar or page chrome
 * (`h-full min-h-0`, no outer padding) and performs no navigation of its own.
 */
export function EntityItemSideBySide({ actions, ...props }: Readonly<EntityItemVariationProps>) {
  const { item } = props;
  // The relations get a column of their own, with room to show them all expanded.
  const sectionProps = useEntityItemSectionProps({ ...props, openAllByDefault: true });

  if (!hasEntityItemRelations(item)) {
    return (
      <div className="h-full min-h-0">
        <EntityItemCard item={item} actions={actions}>
          <EntityItemSections {...sectionProps} />
        </EntityItemCard>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <ResizableSplitLayout
        className="group"
        left={
          <div className="h-full min-h-0 overflow-auto">
            <EntityItemCard item={item} actions={actions}>
              <EntityItemSections {...sectionProps} show="details" />
            </EntityItemCard>
          </div>
        }
        right={
          <section
            aria-label="Relations"
            className="h-full min-h-0 overflow-auto group-data-[stacked]:mt-4"
          >
            <EntityItemSections {...sectionProps} show="relations" relationVariant="card" />
          </section>
        }
        defaultRightSize={384}
        minRightSize={340}
        maxRightSize="60"
        minLeftSize={360}
        stackBelow={STACK_BELOW}
        resizableStacked={false}
        handleLabel="Resize relations"
        // The 1px divider sits in the middle of the gap the column used to leave.
        handleClassName="aria-[orientation=vertical]:mx-2 aria-[orientation=horizontal]:my-2"
      />
    </div>
  );
}
