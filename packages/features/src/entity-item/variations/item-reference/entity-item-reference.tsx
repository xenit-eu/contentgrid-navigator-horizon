import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { ItemReference } from "@contentgrid/ui";
import { STRING_REFERENCE_MAX_CHAR_LENGTH, useEntityItemHeading } from "./use-entity-item-heading";

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
  /**
   * Characters of the title shown before it is truncated with "…", also when the title is the
   * item's id; the full title shows on hover.
   */
  readonly titleMaxCharLength?: number;
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
  titleMaxCharLength = STRING_REFERENCE_MAX_CHAR_LENGTH,
  className,
}: Readonly<EntityItemReferenceProps>) {
  const { preferences, Icon, title, subtitle } = useEntityItemHeading(item, titleMaxCharLength);

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
