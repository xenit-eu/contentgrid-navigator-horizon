import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { FileUploadZone } from "../file-upload-zone";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface FileRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Lets the user pick a file to submit with the create form. The file rides along in the same
 * `multipart/form-data` POST as every other field.
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
  onFocus,
  onBlur,
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
      <FileUploadZone
        id={name}
        file={file}
        onFileChange={(next) => onChange(next ?? undefined)}
        disabled={readOnly}
        onFocus={onFocus}
        onBlur={onBlur}
        {...fieldAriaProps(name, error)}
      />
    </FieldShell>
  );
}
