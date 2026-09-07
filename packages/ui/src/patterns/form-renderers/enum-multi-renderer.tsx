import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Checkbox } from "../../primitives/checkbox";
import { Label } from "../../primitives/label";
import { FieldShell } from "./field-shell";

export interface EnumMultiRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly options: readonly string[];
  /** True when the caller's options source is a remote link not yet resolved into `options`. */
  readonly isRemote?: boolean;
}

export function EnumMultiRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  options,
  isRemote = false,
}: Readonly<EnumMultiRendererProps>) {
  const selected = Array.isArray(value) ? value : [];

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
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={`${name}-${option}`}
                checked={selected.includes(option)}
                onCheckedChange={(checked) => toggle(option, checked === true)}
                disabled={readOnly}
              />
              <Label htmlFor={`${name}-${option}`}>{option}</Label>
            </div>
          ))}
        </div>
      )}
    </FieldShell>
  );
}
