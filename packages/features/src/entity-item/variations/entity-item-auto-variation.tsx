import type { ComponentType } from "react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { EntityItemAttributeFocus } from "./attribute-focus/entity-item-attribute-focus";
import { EntityItemContentFocus } from "./content-focus/entity-item-content-focus";
import type { EntityItemVariationProps } from "./entity-item-variation-props";

/**
 * Every item detail variation `EntityItemAutoVariation` can render, by name. Add a new variation
 * here to make it selectable through the `variation` prop.
 */
const ENTITY_ITEM_VARIATIONS = {
  "attribute-focus": EntityItemAttributeFocus,
  "content-focus": EntityItemContentFocus,
} as const satisfies Record<string, ComponentType<EntityItemVariationProps>>;

/** The name of an item detail variation. */
export type EntityItemVariation = keyof typeof ENTITY_ITEM_VARIATIONS;

/** The names of all item detail variations. */
export const entityItemVariations = Object.keys(
  ENTITY_ITEM_VARIATIONS,
) as readonly EntityItemVariation[];

/**
 * The variation that renders for `profileEntity`: `variation` when it names one, otherwise
 * (`"auto"`) content focus for an entity with content attributes and attribute focus for one
 * without (FR-001).
 */
export function resolveEntityItemVariation(
  profileEntity: ProfileEntity,
  variation: EntityItemVariation | "auto" = "auto",
): EntityItemVariation {
  if (variation !== "auto") {
    return variation;
  }
  return profileEntity.hasContentAttributes ? "content-focus" : "attribute-focus";
}

/**
 * Content padding for whatever wraps {@link EntityItemAutoVariation}. When content focus is what
 * renders, the preview panel should run edge to edge rather than sit inside the standard page
 * gutters — drop the horizontal padding, and the top vertical padding too (the toolbar strip above
 * already has its own bottom padding, so a top gutter here would just double that gap) — keeping
 * only the bottom gutter for breathing room at the end of the scroll region. Attribute focus keeps
 * the standard padding on both axes.
 */
export function entityItemDetailPadding(
  profileEntity: ProfileEntity,
  variation: EntityItemVariation | "auto" = "auto",
): true | "bottom" {
  return resolveEntityItemVariation(profileEntity, variation) === "content-focus" ? "bottom" : true;
}

export type EntityItemAutoVariationProps = Omit<
  EntityItemVariationProps,
  "item" | "onRelationItemClick"
> & {
  /** The already-loaded item; its profile is `entityItem.profileEntity`. */
  readonly entityItem: EntityItem;
  /**
   * Which variation to render. `"auto"` (the default) picks content focus for an entity with
   * content attributes and attribute focus otherwise.
   */
  readonly variation?: EntityItemVariation | "auto";
  /** Fired when the user clicks through to a related entity item, from either a to-one or
   * to-many relation section. */
  readonly onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
};

/**
 * App-agnostic item detail for an already-loaded `entityItem`, with no toolbar, page layout or
 * loading/error state of its own — the view above it (`@contentgrid/views/entity-item-detail`)
 * resolved the item and draws those. Renders the variation named by `variation`, or picks one from
 * the item's profile (see {@link resolveEntityItemVariation}).
 */
export function EntityItemAutoVariation({
  entityItem,
  variation = "auto",
  onRelationItemClick,
  ...props
}: Readonly<EntityItemAutoVariationProps>) {
  const Variation =
    ENTITY_ITEM_VARIATIONS[resolveEntityItemVariation(entityItem.profileEntity, variation)];

  return (
    <Variation
      {...props}
      item={entityItem}
      onRelationItemClick={(entityName, itemId) => onRelationItemClick?.({ entityName, itemId })}
    />
  );
}
