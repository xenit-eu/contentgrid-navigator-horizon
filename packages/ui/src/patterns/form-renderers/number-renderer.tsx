import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { Input } from "../../primitives/input";
import { FieldShell } from "./field-shell";

export interface NumberRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "number" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

export function NumberRenderer({ field, value, onChange, error }: Readonly<NumberRendererProps>) {
  const { name, label, required, readOnly, description } = field;
  const displayValue =
    typeof value === "number" ? String(value) : typeof value === "string" ? value : "";

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
        type="number"
        value={displayValue}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const parsed = Number(raw);
          // Mirrors filter-properties.ts's coerceFilterValue guard — a native number input
          // can still yield a non-finite value (e.g. a pasted number large enough to
          // overflow to Infinity), which must never reach the HAL-FORMS codec.
          onChange(Number.isFinite(parsed) ? parsed : "");
        }}
        readOnly={readOnly}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldShell>
  );
}
