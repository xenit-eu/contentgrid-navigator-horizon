import type { ReactNode } from "react";
import {
  AttributeKind,
  type ContentChangeResults,
  type ContentChanges,
  type EntityItem,
} from "@contentgrid/navigator-data";
import { Card, CardContent, FileRenderer } from "@contentgrid/ui";
import { formatFieldName } from "../../format-field-name";
import type { EditableEntityItem } from "./editable-entity-item";

interface EditContentFieldsProps {
  readonly item: EditableEntityItem;
  /** File changes picked in the form, applied on Save. */
  readonly pendingContent: ContentChanges;
  /** The message of each failed file change, by attribute name; shown on the attribute's card. */
  readonly contentFailures: ReadonlyMap<string, string>;
  readonly onContentChange: (attributeName: string, file: File | null) => void;
  /** While Save applies the file changes, how far each one got; a card shows its upload progress. */
  readonly contentResults?: ContentChangeResults;
  /** Makes every file field read-only, e.g. while Save runs: no file can be picked or removed. */
  readonly disabled?: boolean;
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
 * A file change that failed on Save shows its message on the card. Picking or removing a file only reports the change; nothing is sent before Save. Without the
 * attribute's `cg:content` link, or while `disabled`, the file can't be picked or removed.
 */
export function EditContentFields({
  item,
  pendingContent,
  contentFailures,
  onContentChange,
  contentResults,
  disabled = false,
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
    const change = pendingContent.get(name);
    const file = change ? change.file : storedFile;
    const isPreviewed = canChoosePreview && name === previewedAttributeName;

    return (
      <Card key={name} className="py-4">
        <CardContent className="space-y-3">
          <FileRenderer
            name={name}
            label={contentAttributeLabel(item, name)}
            required={false}
            readOnly={disabled || !item.canUploadContent(name)}
            value={file ?? undefined}
            onChange={(picked) => onContentChange(name, picked ?? null)}
            previewed={isPreviewed}
            onPreview={canChoosePreview && !isPreviewed ? () => onPreview(name) : undefined}
            uploadProgress={contentResults?.get(name)?.progress}
            error={contentFailures.get(name)}
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
