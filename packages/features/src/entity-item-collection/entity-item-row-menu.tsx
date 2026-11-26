import { ArrowRightIcon as ArrowRight, TrashIcon as Trash } from "@phosphor-icons/react";
import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { RecordRowMenu, type RecordRowMenuItem } from "@contentgrid/ui";
import { useEntityDisplayPreferences } from "../preferences";

export interface EntityItemRowMenuProps {
  readonly item: EntityItem;
  /** Adds "Open" to the menu. */
  readonly onOpen?: (item: EntityItem) => void;
  /** Adds "Delete…" (after a separator) when the item can be deleted; asks to confirm first. */
  readonly onDelete?: (item: EntityItem) => void;
  /** Disables "Delete…", e.g. while a delete is running. */
  readonly deleting?: boolean;
}

/** The item's title as text, for an accessible name: its name attribute's value, else its id. */
function itemTitleText(item: EntityItem, nameAttributeName: string | undefined): string {
  const value = nameAttributeName ? item.findAttribute(nameAttributeName)?.value : undefined;
  if (
    value?.kind === AttributeKind.PLAIN &&
    (typeof value.value === "string" || typeof value.value === "number")
  ) {
    return String(value.value);
  }
  return item.id;
}

/**
 * A collection row's actions as one "⋮" menu: "Open" with an arrow, and, only when the item has a
 * delete template, a separator and a destructive "Delete…" that opens the delete confirmation.
 * Renders nothing when neither applies.
 */
export function EntityItemRowMenu({
  item,
  onOpen,
  onDelete,
  deleting,
}: Readonly<EntityItemRowMenuProps>) {
  const { nameAttribute } = useEntityDisplayPreferences(item.profileEntity);

  const items: RecordRowMenuItem[] = [];
  if (onOpen) {
    items.push({
      key: "open",
      label: "Open",
      icon: <ArrowRight aria-hidden />,
      onSelect: () => onOpen(item),
    });
  }
  if (onDelete && item.canDelete) {
    items.push({
      key: "delete",
      label: "Delete…",
      icon: <Trash aria-hidden />,
      destructive: true,
      separatorBefore: items.length > 0,
      disabled: deleting,
      onSelect: () => onDelete(item),
      confirm: {
        title: "Delete item",
        description: `Are you sure you want to delete this ${item.profileEntity.singularName.toLowerCase()}? This action cannot be undone.`,
        actionLabel: "Delete",
      },
    });
  }

  return (
    <RecordRowMenu
      label={`Actions for ${itemTitleText(item, nameAttribute?.name)}`}
      items={items}
    />
  );
}
