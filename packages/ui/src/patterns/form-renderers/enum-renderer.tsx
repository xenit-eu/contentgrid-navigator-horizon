import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { FieldShell } from "./field-shell";
import { resolveInlineOptions } from "./options-source";

export interface EnumRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "enum" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

export function EnumRenderer({ field, value, onChange, error }: Readonly<EnumRendererProps>) {
  const { name, label, required, readOnly, description, optionsSource } = field;
  const options = resolveInlineOptions(optionsSource);
  const selected = typeof value === "string" && value !== "" ? value : undefined;
  const isRemote = optionsSource.kind === "remote";

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      <Select value={selected} onValueChange={onChange} disabled={readOnly || isRemote}>
        <SelectTrigger
          id={name}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          <SelectValue placeholder={isRemote ? "Options not yet loaded" : "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
