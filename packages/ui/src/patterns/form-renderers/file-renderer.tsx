import { FileUploadZone } from "../file-upload-zone";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface FileRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: File | undefined;
  readonly onChange: (value: File | undefined) => void;
  readonly error?: string;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  /** See `FileUploadZone`'s `onPreview`. */
  readonly onPreview?: () => void;
  /** See `FileUploadZone`'s `previewed`. */
  readonly previewed?: boolean;
  /** See `FileUploadZone`'s `compact`. */
  readonly compact?: boolean;
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
  onPreview,
  previewed,
  compact,
}: Readonly<FileRendererProps>) {
  const file = value ?? null;

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
        onPreview={onPreview}
        previewed={previewed}
        compact={compact}
        {...fieldAriaProps(name, error)}
      />
    </FieldShell>
  );
}
