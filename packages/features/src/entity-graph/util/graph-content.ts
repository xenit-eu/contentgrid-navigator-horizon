import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";

/** One file an item holds in a content attribute. */
export interface GraphContentFile {
  readonly attributeName: string;
  readonly attributeTitle: string;
  /** `null` when the file was stored without a name. */
  readonly filename: string | null;
  readonly mimetype: string;
}

/**
 * The item's content attributes that actually hold a file, in profile order. A content attribute
 * holds a file iff its metadata is present (same rule as the content-focus view); empty ones are
 * left out.
 */
export function contentFilesOf(item: EntityItem): GraphContentFile[] {
  const files: GraphContentFile[] = [];
  for (const profileAttribute of item.profileEntity.userDefinedAttributes) {
    if (!profileAttribute.isContent) continue;
    const value = item.findAttribute(profileAttribute.name)?.value;
    if (value?.kind !== AttributeKind.CONTENT || value.metadata === null) continue;
    files.push({
      attributeName: profileAttribute.name,
      attributeTitle: profileAttribute.title ?? profileAttribute.name,
      filename: value.metadata.filename,
      mimetype: value.metadata.mimetype,
    });
  }
  return files;
}

/** The file icon to draw for a mimetype. */
export function contentFileType(mimetype: string): "pdf" | "img" | "doc" {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.startsWith("image/")) return "img";
  return "doc";
}
