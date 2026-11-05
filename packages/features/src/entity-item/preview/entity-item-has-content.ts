import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";

/**
 * Whether the item holds at least one file: a content attribute whose value has metadata
 * (data-model.md: "a file exists iff `metadata !== null`"). An item whose content attributes are
 * all empty has no content to show.
 */
export function entityItemHasContent(item: EntityItem): boolean {
  return item.attributes.some(
    (attr) => attr.value.kind === AttributeKind.CONTENT && attr.value.metadata !== null,
  );
}
