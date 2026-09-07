import { format } from "date-fns";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Input } from "../../primitives/input";
import { FieldShell } from "./field-shell";

export interface DateTimeRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly includesTime: boolean;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Renders as the native `<input>` value string a `date`/`datetime-local` input expects.
 * Formats in local time (mirrors filter-sidebar.tsx's `isoToDatetimeLocalInputValue`) —
 * `toISOString()` renders in UTC, which drifts from what the user typed in any non-UTC
 * timezone since `onChange` below parses the raw input as local time.
 */
function toInputValue(value: FieldValue, includesTime: boolean): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return format(value, includesTime ? "yyyy-MM-dd'T'HH:mm" : "yyyy-MM-dd");
  }
  return typeof value === "string" ? value : "";
}

export function DateTimeRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  includesTime,
  onFocus,
  onBlur,
}: Readonly<DateTimeRendererProps>) {
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
        type={includesTime ? "datetime-local" : "date"}
        value={toInputValue(value, includesTime)}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          // `@contentgrid/hal-forms/values` only accepts a `Date` instance for the
          // datetime/datetime-local wire types — a date-only property expects the
          // raw ISO date string as-is (see HalFormValuesImpl.isValidTypeValue).
          onChange(includesTime ? new Date(raw) : raw);
        }}
        readOnly={readOnly}
        required={required}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldShell>
  );
}
