import { AttributeKind, type ContentMetadata, type EntityItem } from "@contentgrid/navigator-data";

/**
 * Reads a content attribute's metadata off an already-resolved `EntityItem`, without throwing —
 * `undefined` when `attributeName` doesn't name a content attribute on this item at all (a
 * profile/item mismatch), `null` when it does but holds no file (data-model.md: "a file exists
 * iff `metadata !== null`").
 */
export function getContentAttributeMetadata(
  entityItem: EntityItem,
  attributeName: string,
): ContentMetadata | null | undefined {
  const attribute = entityItem.findAttribute(attributeName);
  if (attribute === undefined || attribute.value.kind !== AttributeKind.CONTENT) {
    return undefined;
  }
  return attribute.value.metadata;
}
