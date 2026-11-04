import { useState } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";

/** Reloads the item; the view that owns the item query supplies it. */
export type EntityItemRefetch = () => Promise<{
  readonly data?: EntityItem;
  readonly isSuccess: boolean;
}>;

/** For a caller that cannot reload the item: a refresh then leaves everything as it is. */
export const noRefetch: EntityItemRefetch = async () => ({ isSuccess: false });

/**
 * Everything a variation needs about the shown `item`: the item itself, the `refetch` that reloads
 * it, and its edit mode.
 *
 * While editing, `editedItem` is the version the form was opened on: a background refetch does not
 * change it, so the user's input stays and a save of an item that changed meanwhile is refused
 * (412). `shownItem` is that version while editing and `item` otherwise. `refresh` refetches the
 * item and moves the form onto the latest version. Edit mode belongs to one item, so it ends when
 * the page moves on to another item and stays closed when the page comes back to it.
 */
export function useEntityItemContext(item: EntityItem, refetch: EntityItemRefetch = noRefetch) {
  const href = item.selfLink.href;
  const [editedItem, setEditedItem] = useState<EntityItem | null>(null);
  const [shownHref, setShownHref] = useState(href);
  if (href !== shownHref) {
    setShownHref(href);
    setEditedItem(null);
  }

  const setIsEditing = (isEditing: boolean) => setEditedItem(isEditing ? item : null);
  const refresh = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) setEditedItem(result.data);
  };

  return {
    item,
    shownItem: editedItem ?? item,
    refetch,
    isEditing: editedItem !== null,
    editedItem,
    setIsEditing,
    refresh,
  };
}
