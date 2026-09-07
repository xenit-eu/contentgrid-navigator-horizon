import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Label } from "../../primitives/label";

export interface BooleanRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Doesn't use `FieldShell` — a checkbox's label sits beside the control, not
 * above it, so the shared above-the-input layout doesn't fit here.
 */
export function BooleanRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  onFocus,
  onBlur,
}: Readonly<BooleanRendererProps>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={name}
          name={name}
          checked={value === undefined ? "indeterminate" : value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={readOnly}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <Label htmlFor={name}>
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          )}
        </Label>
        {/* A boolean attribute can genuinely be unset (see use-entity-form-state.ts's isEmpty
         * doc comment) — this is the only way back to that state once the checkbox has been
         * touched, mirroring RelationToOneRenderer's "Unlink" affordance for its own
         * undefined/unset value. */}
        {!readOnly && value !== undefined && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Clear
          </Button>
        )}
      </div>
      {description && !error && <p className="text-sm text-muted-foreground">{description}</p>}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
