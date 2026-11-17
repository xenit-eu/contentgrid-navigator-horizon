import type { ReactNode } from "react";
import { AttributeKind, type ContentChanges, type EntityItem } from "@contentgrid/navigator-data";
import { Card, CardContent, FileRenderer } from "@contentgrid/ui";
import { formatFieldName } from "../../format-field-name";
import type { EditableEntityItem } from "./editable-entity-item";

interface EditContentFieldsProps {
  readonly item: EditableEntityItem;
  /** File changes picked in the form, applied on Save. */
  readonly pendingContent: ContentChanges;
  readonly onContentChange: (attributeName: string, file: File | null) => void;
  /** While Save stores the picked files, each one's upload progress, by attribute name. */
  readonly uploadProgress?: ReadonlyMap<string, number>;
  /** The attribute's filename and mimetype fields, shown under its file while it has one. */
  readonly renderMetadataFields: (attributeName: string) => ReactNode;
  /** The attribute shown in the content preview next to the form, if any. */
  readonly previewedAttributeName?: string;
  /** Shows an attribute's file in the content preview; omitted when there is no preview. */
  readonly onPreview?: (attributeName: string) => void;
}

/**
 * One file field per content attribute of `item`, showing the file picked for it or else the
 * stored one, with the file's filename and mimetype fields, in a card like the relation sections.
 * With several files, the one in the content preview is highlighted and the others offer Preview.
 * Picking or removing a file only reports the change; nothing is sent before Save. Without the
 * attribute's `cg:content` link the file can't be picked or removed.
 */
export function EditContentFields({
  item,
  pendingContent,
  onContentChange,
  uploadProgress,
  renderMetadataFields,
  previewedAttributeName,
  onPreview,
}: Readonly<EditContentFieldsProps>) {
  const contentAttributes = item.attributes.flatMap((attr) =>
    attr.value.kind === AttributeKind.CONTENT ? [attr.value] : [],
  );

  const canChoosePreview = onPreview !== undefined && contentAttributes.length > 1;

  return contentAttributes.map(({ name, metadata }) => {
    const storedFile = metadata && {
      name: metadata.filename ?? "Untitled",
      size: metadata.length,
      type: metadata.mimetype,
    };
    const file = pendingContent.has(name) ? pendingContent.get(name) : storedFile;
    const isPreviewed = canChoosePreview && name === previewedAttributeName;

    return (
      <Card key={name} className="py-4">
        <CardContent className="space-y-3">
          <FileRenderer
            name={name}
            label={contentAttributeLabel(item, name)}
            required={false}
            readOnly={!item.canUploadContent(name)}
            value={file ?? undefined}
            onChange={(picked) => onContentChange(name, picked ?? null)}
            previewed={isPreviewed}
            onPreview={canChoosePreview && !isPreviewed ? () => onPreview(name) : undefined}
            uploadProgress={uploadProgress?.get(name)}
            compact
          />
          {file && renderMetadataFields(name)}
        </CardContent>
      </Card>
    );
  });
}

/** A content attribute's name as shown to the user. */
export function contentAttributeLabel(item: EntityItem, attributeName: string): string {
  return item.profileEntity.getAttribute(attributeName)?.title ?? formatFieldName(attributeName);
}
