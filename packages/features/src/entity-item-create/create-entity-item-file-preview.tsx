import { ContentAttributeOptionSelector, ContentPreviewFrame, FilePreview } from "../entity-item";
import type { HalFormsField } from "../hal-forms";

interface CreateEntityItemFilePreviewProps {
  /** The create form's `file` fields; the preview can switch between them. */
  readonly fileFields: readonly HalFormsField[];
  /** Name of the file field being previewed. */
  readonly fieldName: string;
  readonly onFieldNameChange: (fieldName: string) => void;
  /** The file picked in that field, if any. */
  readonly file: File | undefined;
  /** Puts a file dropped on the empty preview into the field. Absent for a read-only field. */
  readonly onFileChange?: (file: File | null) => void;
}

/**
 * Previews the file picked in one of the create form's file fields, before anything is uploaded,
 * with a selector to switch between the file fields. With no file picked, the preview offers a
 * drop zone.
 */
export function CreateEntityItemFilePreview({
  fileFields,
  fieldName,
  onFieldNameChange,
  file,
  onFileChange,
}: Readonly<CreateEntityItemFilePreviewProps>) {
  const fieldSelector = (
    <ContentAttributeOptionSelector
      options={fileFields.map((field) => ({
        name: field.name,
        title: field.label,
        type: "content",
      }))}
      value={fieldName}
      onChange={onFieldNameChange}
    />
  );

  if (file) {
    return <FilePreview file={file} toolbarStart={fieldSelector} />;
  }

  return (
    <ContentPreviewFrame
      state="noFile"
      onFileChange={onFileChange}
      fill
      toolbarStart={fieldSelector}
    />
  );
}
