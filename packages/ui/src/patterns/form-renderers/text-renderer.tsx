import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Input } from "../../primitives/input";
import { FieldShell } from "./field-shell";

export interface TextRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /** Reserved for a future client-side pattern check — not yet enforced by this input. */
  readonly regex?: RegExp;
  readonly maxLength?: number;
  /** HAL-FORMS `email` wire type — sets the native input's `type` so the browser applies its own
   * format validation/keyboard hint; unset renders a plain `type="text"` input. */
  readonly format?: "email";
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

export function TextRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  maxLength,
  format,
  onFocus,
  onBlur,
}: Readonly<TextRendererProps>) {
  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      <Input
        id={name}
        name={name}
        type={format ?? "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength && maxLength > 0 ? maxLength : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldShell>
  );
}
