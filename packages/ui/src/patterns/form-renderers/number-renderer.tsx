import { Input } from "../../primitives/input";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface NumberRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** A number, or a string as-is (e.g. an already-applied search filter value); `""`/`undefined`
   * for empty. */
  readonly value: number | string | undefined;
  /** A finite number, or `""` when the input is cleared. */
  readonly onChange: (value: number | "") => void;
  readonly error?: string;
  /** See `FieldShellProps.hideLabel`. */
  readonly hideLabel?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

function displayValueFor(value: number | string | undefined): string {
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
  hideLabel,
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
      hideLabel={hideLabel}
    >
      <Input
        id={name}
        name={name}
        type="number"
        value={displayValue}
        onChange={(event) => {
          const input = event.target;
          const raw = input.value;
          if (raw === "") {
            // A native number input reports `value === ""` both when the field is genuinely
            // empty AND while it holds an interim state a full number can start with (a lone
            // "-", ".", or "-.") — `validity.badInput` distinguishes the two. Committing ""
            // for the interim case would force this controlled input back to empty on every
            // render, deleting the "-" before the user can type the digits after it, making a
            // negative (or decimal-leading) value impossible to enter by typing.
            if (input.validity.badInput) return;
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
