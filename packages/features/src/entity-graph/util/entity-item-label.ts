import { AttributeKind } from "@contentgrid/navigator-data";
import type { EntityItem, ProfileAttribute } from "@contentgrid/navigator-data";

/**
 * Plain-string display label of an item for the graph (node labels, aria-labels, tooltips,
 * dialog texts): the scalar value of the user's preferred name attribute, falling back to the
 * item id when there is no such attribute or it has no (scalar, non-empty) value.
 *
 * Unlike `EntityItemReference` this returns a string, not a ReactNode. No truncation here — the
 * graph pattern truncates visually and keeps the full text for tooltips.
 */
export function entityItemLabel(
  item: EntityItem,
  nameAttribute: Pick<ProfileAttribute, "name"> | undefined,
): string {
  const attr = nameAttribute ? item.findAttribute(nameAttribute.name) : undefined;
  if (attr?.value.kind === AttributeKind.PLAIN) {
    const raw = attr.value.value;
    if (raw !== null && raw !== undefined) {
      const text = String(raw).trim();
      if (text.length > 0) return text;
    }
  }
  return item.id;
}
