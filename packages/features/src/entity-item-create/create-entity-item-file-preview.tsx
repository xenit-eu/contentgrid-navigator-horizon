import { ContentAttributeOptionSelector, ContentPreviewFrame, FilePreview } from "../entity-item";
import type { HalFormsField } from "../hal-forms";

interface CreateEntityItemFilePreviewProps {
  /** The create form's `file` fields, listed in the selector. */
  readonly fileFields: readonly HalFormsField[];
  /** Name of the file field being previewed. */
  readonly fieldName: string;
  /**
   * Switches the preview to another file field, from the preview itself. Passed when the preview
   * covers the form; without it the user switches fields in the form.
   */
  readonly onFieldNameChange?: (fieldName: string) => void;
  /** The file picked in that field, if any. */
  readonly file: File | undefined;
  /** Puts a file dropped on the empty preview into the field. Absent for a read-only field. */
  readonly onFileChange?: (file: File | null) => void;
}

/**
 * Previews the file picked in one of the create form's file fields, before anything is uploaded,
 * with the previewed field named in its toolbar. With no file picked, the preview offers a drop
 * zone. Beside the form, screen readers are also told when the user switches fields in the form.
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
  const fieldLabel = fileFields.find((field) => field.name === fieldName)?.label ?? fieldName;

  return (
    <>
      {!onFieldNameChange && (
        <p role="status" className="sr-only">
          Previewing {fieldLabel}
        </p>
      )}
      {file ? (
        <FilePreview file={file} toolbarStart={fieldSelector} />
      ) : (
        <ContentPreviewFrame
          state="noFile"
          onFileChange={onFileChange}
          fill
          toolbarStart={fieldSelector}
        />
      )}
    </>
  );
}
