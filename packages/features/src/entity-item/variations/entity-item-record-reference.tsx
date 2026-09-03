import type { EntityItem } from "@contentgrid/navigator-data";
import { ItemReference } from "@contentgrid/ui";
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../../preferences";
import { AttributeValueRenderer } from "../attributes/renderers/attribute-value-renderer";

export interface EntityItemReferenceProps {
  readonly item: EntityItem;
  readonly onClick?: () => void;
  readonly selected?: boolean;
  readonly size?: "sm" | "default" | "lg";
  /** Blends the icon badge into a soft, semi-transparent fill instead of a solid one. */
  readonly muted?: boolean;
  /** Renders the icon badge with a border and icon in the entity's color instead of a solid
   * fill. Combined with `muted`, the background keeps the soft muted fill instead of going
   * fully transparent — see `IconBadge`'s doc comment. */
  readonly outlined?: boolean;
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
  muted,
  outlined,
  className,
}: Readonly<EntityItemReferenceProps>) {
  const { preferences, nameAttribute, subtitleAttribute } = useEntityDisplayPreferences(
    item.profileEntity,
  );
  const Icon = resolveEntityCardIcon(preferences.icon);

  const nameAttr = nameAttribute ? item.findAttribute(nameAttribute.name) : undefined;
  const title = nameAttr ? <AttributeValueRenderer attr={nameAttr} /> : item.id;

  const subtitleAttr = subtitleAttribute ? item.findAttribute(subtitleAttribute.name) : undefined;
  const subtitle = subtitleAttr ? <AttributeValueRenderer attr={subtitleAttr} /> : undefined;

  return (
    <ItemReference
      icon={<Icon />}
      color={preferences.color}
      muted={muted}
      outlined={outlined}
      title={title}
      subtitle={subtitle}
      onClick={onClick}
      selected={selected}
      size={size}
      className={className}
    />
  );
}
