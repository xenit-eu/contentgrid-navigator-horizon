import { type Ref, useImperativeHandle, useMemo, useRef } from "react";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import type { EditEntityItemFormHandle } from "./edit/edit-entity-item-container";
import type { EntityItemEditHandle } from "./edit/entity-item-edit-handle";
import { ATTRIBUTES_SECTION, type EntityItemSectionsProps } from "./entity-item-sections";
import { type EntityItemRefetch, useEntityItemContext } from "./use-entity-item-context";

export type UseEntityItemSectionPropsOptions = Pick<
  EntityItemSectionsProps,
  | "item"
  | "openAllByDefault"
  | "onRelationItemClick"
  | "onRelationItemCreateNew"
  | "onMissingRelationTargetClick"
  | "onBlindRelationOverwriteClick"
  | "onRequiredRelationClick"
> & {
  /**
   * `false` shows the item read-only: the sections get `item.toReadOnly()`, so no edit, delete,
   * upload or relation change is offered. Defaults to `true`.
   */
  readonly allowEdit?: boolean;
  /** Reloads the item; see `useEntityItemContext`. */
  readonly refetch?: EntityItemRefetch;
  /**
   * Hears every change of edit mode; see `useEntityItemContext`. Not passed on to
   * `EntityItemSections`, whose own `onEditingChange` opens and closes the form.
   */
  readonly onEditingChange?: (isEditing: boolean) => void;
  /**
   * Fills the handle through which the caller opens and cancels the edit form (see
   * `EntityItemEditHandle`). Passing it also makes the sections draw no Edit or Cancel button.
   */
  readonly editHandleRef?: Ref<EntityItemEditHandle>;
  /** Fired when the handle's `startEdit` runs, e.g. for a variation to reveal a collapsed panel. */
  readonly onStartEdit?: () => void;
};

/**
 * Everything a variation passes to `EntityItemSections` for `item`, wired to the item's context
 * (`useEntityItemContext`: edit mode, refresh and section state) and the loaded profiles. Spread
 * the result onto every `EntityItemSections` the variation renders, so a new section prop or
 * handler only needs adding here. Its `item` is the read-only copy when `allowEdit` is false; the
 * variation shows that one everywhere.
 */
export function useEntityItemSectionProps({
  item,
  refetch,
  allowEdit = true,
  openAllByDefault = false,
  onEditingChange,
  editHandleRef,
  onStartEdit,
  ...handlers
}: Readonly<UseEntityItemSectionPropsOptions>): EntityItemSectionsProps {
  const { profiles } = useLoadedProfileEntities();
  const sectionItem = useMemo(() => (allowEdit ? item : item.toReadOnly()), [item, allowEdit]);
  const itemContext = useEntityItemContext(sectionItem, refetch, onEditingChange);
  const editFormRef = useRef<EditEntityItemFormHandle>(null);

  useImperativeHandle(editHandleRef, () => ({
    startEdit: () => {
      // The form opens inside the Attributes section, so make sure it is expanded.
      itemContext.sections.openProps(ATTRIBUTES_SECTION, true).onOpenChange(true);
      onStartEdit?.();
      itemContext.setIsEditing(true);
    },
    // Without a mounted form (e.g. its panel is collapsed) there is nothing to confirm.
    cancelEdit: () =>
      editFormRef.current ? editFormRef.current.cancel() : itemContext.setIsEditing(false),
  }));

  return {
    item: sectionItem,
    profiles,
    state: itemContext.sections,
    editedItem: itemContext.editedItem,
    onEditingChange: itemContext.setIsEditing,
    editFormRef,
    externalEditControl: editHandleRef !== undefined,
    onRefresh: () => void itemContext.refresh(),
    openAllByDefault,
    ...handlers,
  };
}
