import { useMemo } from "react";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import type { EntityItemSectionsProps } from "./entity-item-sections";
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
  ...handlers
}: Readonly<UseEntityItemSectionPropsOptions>): EntityItemSectionsProps {
  const { profiles } = useLoadedProfileEntities();
  const sectionItem = useMemo(() => (allowEdit ? item : item.toReadOnly()), [item, allowEdit]);
  const itemContext = useEntityItemContext(sectionItem, refetch, onEditingChange);

  return {
    item: sectionItem,
    profiles,
    state: itemContext.sections,
    editedItem: itemContext.editedItem,
    onEditingChange: itemContext.setIsEditing,
    onRefresh: () => void itemContext.refresh(),
    pendingContent: itemContext.pendingContent,
    onPendingContentChange: itemContext.setPendingContent,
    openAllByDefault,
    ...handlers,
  };
}
