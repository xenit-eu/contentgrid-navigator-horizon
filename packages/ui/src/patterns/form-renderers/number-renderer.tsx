import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Input } from "../../primitives/input";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface NumberRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

function displayValueFor(value: FieldValue): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

export function NumberRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  min,
  max,
  step,
  onFocus,
  onBlur,
}: Readonly<NumberRendererProps>) {
  const displayValue = displayValueFor(value);

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
        min={min}
        max={max}
        step={step}
        onFocus={onFocus}
        onBlur={onBlur}
        {...fieldAriaProps(name, error)}
      />
    </FieldShell>
  );
}
