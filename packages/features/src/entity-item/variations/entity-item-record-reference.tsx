import type { EntityItem } from "@contentgrid/navigator-data";
import { ItemReference } from "@contentgrid/ui";
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../../preferences";
import { formatAttributeValue } from "../attributes/attribute-format";

export interface EntityItemReferenceProps {
  readonly item: EntityItem;
  readonly onClick?: () => void;
  readonly selected?: boolean;
  readonly size?: "sm" | "default" | "lg";
  readonly className?: string;
}

/**
 * Renders an EntityItem as an ItemReference — icon and color from entity display
 * preferences, title from the preferred name attribute (falls back to the item id
 * when no name attribute is configured or the item has no value for it), subtitle
 * from the preferred subtitle attribute (omitted when none is configured or the
 * item has no value for it).
 */
export function EntityItemReference({
  item,
  onClick,
  selected,
  size,
  className,
}: Readonly<EntityItemReferenceProps>) {
  const { preferences, nameAttribute, subtitleAttribute } = useEntityDisplayPreferences(
    item.profileEntity,
  );
  const Icon = resolveEntityCardIcon(preferences.icon);

  const nameAttr = nameAttribute ? item.findAttribute(nameAttribute.name) : undefined;
  const title = nameAttr ? formatAttributeValue(nameAttr) : item.id;

  const subtitleAttr = subtitleAttribute ? item.findAttribute(subtitleAttribute.name) : undefined;
  const subtitle = subtitleAttr ? formatAttributeValue(subtitleAttr) : undefined;

  return (
    <ItemReference
      icon={<Icon />}
      color={preferences.color}
      title={title}
      subtitle={subtitle}
      onClick={onClick}
      selected={selected}
      size={size}
      className={className}
    />
  );
}
