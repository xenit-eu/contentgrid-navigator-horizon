import { type FileSummary, FileUploadZone } from "../file-upload-zone";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface FileRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** The picked file, or a file already stored on the server. */
  readonly value: FileSummary | undefined;
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
  /** See `FileUploadZone`'s `uploadProgress`. */
  readonly uploadProgress?: number;
}

/** File picker field; `onChange` gets the picked `File`, or `undefined` when the file is removed. */
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
  uploadProgress,
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
        uploadProgress={uploadProgress}
        {...fieldAriaProps(name, error)}
      />
    </FieldShell>
  );
}
