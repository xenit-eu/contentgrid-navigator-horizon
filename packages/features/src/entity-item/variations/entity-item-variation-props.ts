import type { ReactNode, Ref } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import type { EntityItemEditHandle } from "../edit/entity-item-edit-handle";
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
   * `false` shows the item read-only (default `true`): the variation renders `item.toReadOnly()`,
   * so no edit, delete, upload or relation change is offered. With `true`, each action still only
   * shows when the item's templates and links permit it.
   */
  readonly allowEdit?: boolean;
  /**
   * Fired after the item was deleted; the caller navigates away. Without this prop, no delete button is shown.
   */
  readonly onDeleted?: () => void;
  /**
   * Fired when the item's edit mode opens or closes (also `false` when the variation unmounts
   * while editing), so the caller can adapt what it draws around the item, e.g. hide a Delete in
   * its toolbar while the edit form is open. Pass a stable function (e.g. a `useState` setter),
   * not an inline arrow.
   */
  readonly onEditingChange?: (isEditing: boolean) => void;
  /**
   * Lets the caller open and cancel edit mode from its own buttons (see `EntityItemEditHandle`).
   * When given, the variation draws no Edit or Cancel edit button of its own. The caller gates
   * Edit itself, with `isEditableEntityItem`.
   */
  readonly editHandleRef?: Ref<EntityItemEditHandle>;
};
