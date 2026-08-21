import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { Checkbox } from "../../primitives/checkbox";
import { Label } from "../../primitives/label";
import { FieldShell } from "./field-shell";
import { resolveInlineOptions } from "./options-source";

export interface EnumMultiRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "enum-multi" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

export function EnumMultiRenderer({
  field,
  value,
  onChange,
  error,
}: Readonly<EnumMultiRendererProps>) {
  const { name, label, required, readOnly, description, optionsSource } = field;
  const options = resolveInlineOptions(optionsSource);
  const selected = Array.isArray(value) ? value : [];
  const isRemote = optionsSource.kind === "remote";

  function toggle(optionValue: string, checked: boolean) {
    onChange(checked ? [...selected, optionValue] : selected.filter((v) => v !== optionValue));
  }

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      {isRemote ? (
        <p className="text-sm text-muted-foreground">Options not yet loaded</p>
      ) : (
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`${name}-${option.value}`}
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, checked === true)}
                disabled={readOnly}
              />
              <Label htmlFor={`${name}-${option.value}`}>{option.label}</Label>
            </div>
          ))}
        </div>
      )}
    </FieldShell>
  );
}
