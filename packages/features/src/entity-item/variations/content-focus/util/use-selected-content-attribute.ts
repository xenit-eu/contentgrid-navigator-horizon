import { useCallback, useState } from "react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { selectDefaultContentAttribute } from "./select-default-content-attribute";

interface UserChoice {
  readonly entityName: string;
  readonly itemId: string;
  /** `undefined` means "use the data-model default". */
  readonly attribute: string | undefined;
}

/**
 * The content attribute shown for an item, and the setter for the user's own pick. Without a pick
 * it is the data-model default (`selectDefaultContentAttribute`); `undefined` only when the
 * profile has no content attributes.
 *
 * The pick belongs to one item identity — entity AND id, not just id (`/document/1` ->
 * `/invoice/1` keeps the id with a different entity) — so a choice for one item never leaks into
 * the next (FR-006). The reset is derived while rendering, not in an effect: an effect only
 * clears AFTER the render that switched item commits, and for that one render a stale pick would
 * reach `useContentPreview`, which throws for an attribute that is not a content attribute of
 * the current item. A pick that is no longer a content attribute of the profile falls back to the
 * default as well.
 */
export function useSelectedContentAttribute(
  profileEntity: ProfileEntity,
  item: EntityItem,
): readonly [attributeName: string | undefined, selectAttribute: (name: string) => void] {
  const entityName = profileEntity.name;
  const itemId = item.id;
  const [choice, setChoice] = useState<UserChoice>({
    entityName,
    itemId,
    attribute: undefined,
  });

  // Another item: forget the pick now (React re-renders at once, before anything commits).
  if (choice.entityName !== entityName || choice.itemId !== itemId) {
    setChoice({ entityName, itemId, attribute: undefined });
  }

  const picked =
    choice.entityName === entityName && choice.itemId === itemId ? choice.attribute : undefined;
  const pickIsContentAttribute =
    picked !== undefined &&
    profileEntity.userDefinedAttributes.some((attr) => attr.isContent && attr.name === picked);
  const attributeName =
    (pickIsContentAttribute ? picked : undefined) ??
    selectDefaultContentAttribute(profileEntity, item);

  const selectAttribute = useCallback(
    (attribute: string) => setChoice({ entityName, itemId, attribute }),
    [entityName, itemId],
  );

  return [attributeName, selectAttribute];
}
