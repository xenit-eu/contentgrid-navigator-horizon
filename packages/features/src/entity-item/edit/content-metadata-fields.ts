import {
  AttributeKind,
  type ContentChange,
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
 * What the form starts with in a content attribute's filename and mimetype fields: the stored
 * values, or the empty text of a field with none. A change that is taken back restores these, so
 * the form is no longer dirty because of it.
 */
export function startingMetadataValues(
  item: EditableEntityItem,
  attributeName: string,
): Record<string, FieldValue> {
  return Object.fromEntries(
    Object.entries(storedMetadataValues(item, attributeName)).map(([name, value]) => [
      name,
      value ?? "",
    ]),
  );
}

/**
 * The values of a content attribute's filename and mimetype fields for a file change: the name and
 * type the change stores the file under (the picked file's own unless given), or none when the file
 * is removed.
 */
export function changedFileMetadataValues(
  item: EditableEntityItem,
  attributeName: string,
  { file, filename, mimetype }: ContentChange,
): Record<string, FieldValue> {
  const names = item.updateTemplate.contentMetadataPropertyNames(attributeName);
  const values: Record<string, FieldValue> = {};
  if (names.filename) values[names.filename] = file ? (filename ?? file.name) : undefined;
  if (names.mimetype)
    values[names.mimetype] = file ? mimetype || file.type || undefined : undefined;
  return values;
}

/** The item's values, with the fields of the file changes already waiting (kept after a refresh). */
export function initialFormValues(
  item: EditableEntityItem,
  pendingContent: ContentChanges,
): FieldValueMap {
  const values = { ...item.updateFormValues };
  for (const [attributeName, change] of pendingContent) {
    Object.assign(values, changedFileMetadataValues(item, attributeName, change));
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
