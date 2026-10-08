import { useState } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";

/**
 * Edit mode of the shown `item`. While editing, `editedItem` is the version the form was opened
 * on: a background refetch does not change it, so the user's input stays and a save of an item
 * that changed meanwhile is refused (412). `refresh` refetches the item and moves the form onto the
 * latest version. Edit mode belongs to one item, so it ends when the page moves on to another item
 * and stays closed when the page comes back to it.
 */
export function useEditMode(
  item: EntityItem | undefined,
  refetch: () => Promise<{ readonly data?: EntityItem; readonly isSuccess: boolean }>,
) {
  const href = item?.selfLink.href;
  const [editedItem, setEditedItem] = useState<EntityItem | null>(null);
  const [shownHref, setShownHref] = useState(href);
  if (href !== shownHref) {
    setShownHref(href);
    setEditedItem(null);
  }

  const setIsEditing = (isEditing: boolean) => setEditedItem(isEditing ? (item ?? null) : null);
  const refresh = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) setEditedItem(result.data);
  };

  return { isEditing: editedItem !== null, editedItem, setIsEditing, refresh };
}
