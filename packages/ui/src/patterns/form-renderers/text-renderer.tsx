import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/form-fields";
import { Input } from "../../primitives/input";
import { FieldShell } from "./field-shell";

export interface TextRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "text" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

export function TextRenderer({ field, value, onChange, error }: Readonly<TextRendererProps>) {
  const { name, label, required, readOnly, description, minLength, maxLength } = field;

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
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        minLength={minLength > 0 ? minLength : undefined}
        maxLength={maxLength > 0 ? maxLength : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldShell>
  );
}
