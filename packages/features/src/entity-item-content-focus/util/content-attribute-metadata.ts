import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";

/**
 * Mirrors the shape of navigator-data's (unexported) `ContentMetadata` interface structurally,
 * so this feature can name the type without importing it — `EntityItemAttributeContent.metadata`
 * is `ContentMetadata | null` but that interface has no `export` keyword in
 * `accessors/entity-item.ts`, so it isn't part of the package's public API surface.
 */
export interface ContentAttributeMetadata {
  readonly length: number;
  readonly mimetype: string;
  readonly filename: string | null;
}

/**
 * Reads a content attribute's metadata off an already-resolved `EntityItem`, without throwing —
 * `undefined` when `attributeName` doesn't name a content attribute on this item at all (a
 * profile/item mismatch), `null` when it does but holds no file (data-model.md: "a file exists
 * iff `metadata !== null`").
 */
export function getContentAttributeMetadata(
  entityItem: EntityItem,
  attributeName: string,
): ContentAttributeMetadata | null | undefined {
  const attribute = entityItem.attributes.find((attr) => attr.value.name === attributeName);
  if (attribute === undefined || attribute.value.kind !== AttributeKind.CONTENT) {
    return undefined;
  }
  return attribute.value.metadata;
}
