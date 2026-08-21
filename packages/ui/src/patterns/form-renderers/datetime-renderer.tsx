import { format } from "date-fns";
import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { Input } from "../../primitives/input";
import { FieldShell } from "./field-shell";

export interface DateTimeRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "datetime" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
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
  field,
  value,
  onChange,
  error,
}: Readonly<DateTimeRendererProps>) {
  const { name, label, required, readOnly, description, includesTime } = field;

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
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldShell>
  );
}
