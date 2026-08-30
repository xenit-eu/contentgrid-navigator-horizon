import type { EntityItem } from "@contentgrid/navigator-data";
import { ItemReference } from "@contentgrid/ui";
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../../preferences";
import { AttributeValueRenderer } from "../attributes/renderers/attribute-value-renderer";

export interface EntityRecordReferenceProps {
  readonly item: EntityItem;
  readonly onClick?: () => void;
  readonly selected?: boolean;
  readonly size?: "sm" | "default" | "lg";
  readonly className?: string;
}

/**
 * Renders an EntityItem as an ItemReference — icon and color from entity display
 * preferences, title from the preferred name attribute (falls back to the item id
 * when no name attribute is configured or the item has no value for it).
 */
export function EntityRecordReference({
  item,
  onClick,
  selected,
  size,
  className,
}: Readonly<EntityRecordReferenceProps>) {
  const { preferences, nameAttribute } = useEntityDisplayPreferences(item.profileEntity);
  const Icon = resolveEntityCardIcon(preferences.icon);

  const nameAttr = nameAttribute ? item.findAttribute(nameAttribute.name) : undefined;
  const title = nameAttr ? <AttributeValueRenderer attr={nameAttr} /> : item.id;

  return (
    <ItemReference
      icon={<Icon />}
      color={preferences.color}
      title={title}
      onClick={onClick}
      selected={selected}
      size={size}
      className={className}
    />
  );
}
