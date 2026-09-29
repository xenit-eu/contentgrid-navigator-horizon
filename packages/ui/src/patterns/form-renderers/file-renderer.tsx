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

/** File picker field; the value is the picked `File`, or `undefined` when none is picked. */
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
