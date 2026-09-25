import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { FileUpload } from "../file-upload";
import { FieldShell } from "./field-shell";

export interface FileRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

/**
 * Lets the user pick a file to submit with the create form. The file rides along in the same
 * `multipart/form-data` POST as every other field, so no upload progress is shown here.
 */
export function FileRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
}: Readonly<FileRendererProps>) {
  const file = value instanceof File ? value : null;

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      {!readOnly && (
        <FileUpload
          currentFileMetadata={
            file ? { filename: file.name, mimetype: file.type, length: file.size } : null
          }
          onUpload={(next) => onChange(next ?? undefined)}
        />
      )}
    </FieldShell>
  );
}
