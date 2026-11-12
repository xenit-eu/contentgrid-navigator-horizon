import {
  AttributeKind,
  type ContentChanges,
  type FieldValue,
  type FieldValueMap,
} from "@contentgrid/navigator-data";
import type { LayoutSchema } from "../../hal-forms";
import type { EditableEntityItem } from "./editable-entity-item";

/** The names of a content attribute's filename and mimetype fields that the update form has. */
export function contentMetadataFieldNames(
  item: EditableEntityItem,
  attributeName: string,
): string[] {
  const { filename, mimetype } = item.updateTemplate.contentMetadataPropertyNames(attributeName);
  return [filename, mimetype].filter((name) => name !== undefined);
}

/** The stored values of a content attribute's filename and mimetype fields. */
export function storedMetadataValues(
  item: EditableEntityItem,
  attributeName: string,
): Record<string, FieldValue> {
  const storedValues = item.updateFormValues ?? {};
  return Object.fromEntries(
    contentMetadataFieldNames(item, attributeName).map((name) => [name, storedValues[name]]),
  );
}

/**
 * The values of a content attribute's filename and mimetype fields for a file change: the picked
 * file's own name and type, or none when the file is removed (`null`).
 */
export function changedFileMetadataValues(
  item: EditableEntityItem,
  attributeName: string,
  file: File | null,
): Record<string, FieldValue> {
  const { filename, mimetype } = item.updateTemplate.contentMetadataPropertyNames(attributeName);
  const values: Record<string, FieldValue> = {};
  if (filename) values[filename] = file?.name;
  if (mimetype) values[mimetype] = file?.type || undefined;
  return values;
}

/** The item's values, with the fields of the file changes already waiting (kept after a refresh). */
export function initialFormValues(
  item: EditableEntityItem,
  pendingContent: ContentChanges,
): FieldValueMap {
  const values = { ...item.updateFormValues };
  for (const [attributeName, file] of pendingContent) {
    Object.assign(values, changedFileMetadataValues(item, attributeName, file));
  }
  return values;
}

/** The form layout without the content attributes' filename and mimetype fields, which show under
 * each attribute's file field instead. */
export function layoutWithoutContentMetadata(
  item: EditableEntityItem,
  layout: LayoutSchema,
): LayoutSchema {
  const metadataFieldNames = new Set(
    item.attributes.flatMap((attr) =>
      attr.value.kind === AttributeKind.CONTENT
        ? contentMetadataFieldNames(item, attr.value.name)
        : [],
    ),
  );
  return {
    sections: layout.sections.map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) => !row.fieldNames.some((name) => metadataFieldNames.has(name)),
      ),
    })),
  };
}

/** A layout with one row per filename and mimetype field of a content attribute. */
export function metadataFieldsLayout(
  item: EditableEntityItem,
  attributeName: string,
): LayoutSchema {
  return {
    sections: [
      {
        rows: contentMetadataFieldNames(item, attributeName).map((name) => ({
          fieldNames: [name],
        })),
      },
    ],
  };
}
