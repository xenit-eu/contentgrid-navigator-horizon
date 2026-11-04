import type { ReactNode } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "../relations/relation-handlers";
import type { EntityItemRefetch } from "../use-entity-item-context";

/**
 * The props every item detail variation (`attribute-focus`, `content-focus`, …) takes, so any of
 * them can render the same item — `EntityItemAutoVariation` picks one and passes these through.
 */
export type EntityItemVariationProps = RelationProblemHandlers & {
  /** The loaded item (and, through it, its profile). The caller owns loading it. */
  readonly item: EntityItem;
  /**
   * Fired when the user clicks through to a related entity item, from either a to-one or to-many
   * relation section; receives the target entity's profile name and the item's id.
   */
  readonly onRelationItemClick?: RelationItemClickHandler;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * Reloads the item; the view that owns the item query supplies it. After a version conflict the
   * edit form's Refresh calls it and moves the form onto the latest version.
   */
  readonly refetch?: EntityItemRefetch;
  /**
   * Extra actions for the item (e.g. buttons), drawn in the item's header next to the edit
   * button. The caller owns what they do.
   */
  readonly actions?: ReactNode;
  /**
   * Whether to show the edit button (default `true`). The button still only shows when the item
   * has an update template.
   */
  readonly allowEdit?: boolean;
};
