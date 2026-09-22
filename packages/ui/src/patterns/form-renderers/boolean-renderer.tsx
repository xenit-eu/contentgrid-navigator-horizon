import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Label } from "../../primitives/label";
import { SelectionChip } from "../../primitives/selection-chip";
import { FieldMessage, RequiredMarker, fieldAriaProps } from "./field-shell";

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
 * Two mutually-exclusive chips ("True"/"False", `SelectionChip`'s `sm` size) rather than a
 * checkbox, plus the same "Clear" affordance the earlier checkbox-based renderer used to reset
 * back to unset — a boolean attribute can genuinely be unset (see `use-entity-form-state.ts`'s
 * `isEmpty` doc comment), and "Clear" being visible IS the unset feedback: its absence means the
 * field is already unset, its presence means a value is set and can be reset. A third "Unset"
 * chip was tried instead, but non-blue-when-active gave no feedback that it was the active
 * state, so this reverts to "Clear" (now sized to match the chips).
 *
 * Doesn't use `FieldShell` — its single-child, above-the-input layout doesn't fit a row of
 * chips-plus-button (and `id`/`aria-*` here belong on the chip group, not on a single control).
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
  function select(next: FieldValue) {
    if (!readOnly) onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      <div
        id={name}
        role="group"
        aria-label={label}
        className={cn("flex items-center gap-2", readOnly && "pointer-events-none opacity-50")}
        onFocus={onFocus}
        onBlur={onBlur}
        {...fieldAriaProps(name, error)}
      >
        <SelectionChip
          label="True"
          size="sm"
          selected={value === true}
          onClick={() => select(true)}
        />
        <SelectionChip
          label="False"
          size="sm"
          selected={value === false}
          onClick={() => select(false)}
        />
        {!readOnly && value !== undefined && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Clear
          </Button>
        )}
      </div>
      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
