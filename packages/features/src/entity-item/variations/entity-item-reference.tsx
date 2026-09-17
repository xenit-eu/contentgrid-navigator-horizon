import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
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

const STRING_REFERENCE_MAX_CHAR_LENGTH = 120;
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
  const title = nameAttr ? (
    <AttributeValueRenderer
      attr={nameAttr}
      maxCharLength={STRING_REFERENCE_MAX_CHAR_LENGTH}
      variant="item-reference"
    />
  ) : (
    item.id
  );

  const subtitleAttr = subtitleAttribute ? item.findAttribute(subtitleAttribute.name) : undefined;
  const subtitle = subtitleAttr ? (
    <AttributeValueRenderer attr={subtitleAttr} variant="item-reference" />
  ) : undefined;

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

export interface EntityItemReferenceLoadingProps {
  readonly size?: "sm" | "default" | "lg";
  readonly className?: string;
}

/**
 * Placeholder shown in place of `EntityItemReference` while its `EntityItem` is still
 * loading — the same `ItemReference` row, with a spinning icon standing in for the
 * entity icon and a "Loading…" title, so the layout doesn't jump when the real
 * reference swaps in.
 */
export function EntityItemReferenceLoading({
  size = "default",
  className,
}: Readonly<EntityItemReferenceLoadingProps>) {
  return (
    <ItemReference
      icon={<CircleNotch className="animate-spin" aria-hidden />}
      muted
      title="Loading…"
      size={size}
      className={className}
    />
  );
}
