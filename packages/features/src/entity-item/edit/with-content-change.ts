import type { ContentChanges, EntityItem } from "@contentgrid/navigator-data";
import { getContentAttributeMetadata } from "../content-attribute-metadata";

/**
 * `pendingContent` with a file picked (`File`) or removed (`null`) for one content attribute of
 * `item`. Removing means "no file here": the stored file is removed on Save; with no stored file
 * there is nothing to remove, so only the pick is dropped.
 */
export function withContentChange(
  pendingContent: ContentChanges,
  item: EntityItem,
  attributeName: string,
  file: File | null,
): ContentChanges {
  const next = new Map(pendingContent);
  const hasStoredFile = Boolean(getContentAttributeMetadata(item, attributeName));
  if (file === null && !hasStoredFile) {
    next.delete(attributeName);
  } else {
    next.set(attributeName, file);
  }
  return next;
}
