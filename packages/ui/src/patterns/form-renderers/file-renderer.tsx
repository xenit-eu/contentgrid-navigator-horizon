import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { ContentUploadField } from "../content-upload-field";
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
  /** HAL-FORMS `multiValue` for this property — see the doc comment below for how it's handled. */
  readonly multiple: boolean;
}

/**
 * Lets the user pick a file to submit alongside the rest of the create form. No upload progress
 * here — the file rides along in the same `multipart/form-data` POST as every other field (the
 * server's create-form template declares that content type whenever the entity has a content
 * attribute; see `@contentgrid/hal-forms/codecs`'s `FormDataEncoder`). This is a distinct concern
 * from `ContentUploadField`'s progress/cancel/retry props, which apply only to replacing content
 * on an entity that already exists — those are simply left unset here.
 *
 * `multiple` only changes whether a selected file is emitted as a bare `File` or a one-element
 * array (matching the HAL-FORMS wire shape for a multi-value property) — the picker itself still
 * shows a single slot.
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
  multiple,
}: Readonly<FileRendererProps>) {
  const file = value instanceof File ? value : Array.isArray(value) ? (value[0] ?? null) : null;

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      {readOnly ? (
        <p className="text-sm text-muted-foreground">{file?.name ?? "Not editable"}</p>
      ) : (
        <ContentUploadField
          file={file}
          onFileChange={(next) => onChange(next ? (multiple ? [next] : next) : undefined)}
        />
      )}
    </FieldShell>
  );
}
