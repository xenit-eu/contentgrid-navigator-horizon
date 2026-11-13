import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import type { EntityItemSectionsProps } from "./entity-item-sections";
import { type EntityItemRefetch, useEntityItemContext } from "./use-entity-item-context";

export type UseEntityItemSectionPropsOptions = Pick<
  EntityItemSectionsProps,
  | "item"
  | "allowEdit"
  | "openAllByDefault"
  | "onRelationItemClick"
  | "onRelationItemCreateNew"
  | "onMissingRelationTargetClick"
  | "onBlindRelationOverwriteClick"
  | "onRequiredRelationClick"
> & {
  /** Reloads the item; see `useEntityItemContext`. */
  readonly refetch?: EntityItemRefetch;
};

/**
 * Everything a variation passes to `EntityItemSections` for `item`, wired to the item's context
 * (`useEntityItemContext`: edit mode, refresh and section state) and the loaded profiles. Spread
 * the result onto every `EntityItemSections` the variation renders, so a new section prop or
 * handler only needs adding here.
 */
export function useEntityItemSectionProps({
  item,
  refetch,
  allowEdit = true,
  openAllByDefault = false,
  ...handlers
}: Readonly<UseEntityItemSectionPropsOptions>): EntityItemSectionsProps {
  const { profiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);

  return {
    item,
    profiles,
    state: itemContext.sections,
    editedItem: itemContext.editedItem,
    onEditingChange: itemContext.setIsEditing,
    onRefresh: () => void itemContext.refresh(),
    allowEdit,
    openAllByDefault,
    ...handlers,
  };
}
