import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/form-fields";
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

/**
 * Radix `Select` disallows `value=""` on an item, and once a value is picked there's no
 * built-in way back to unselected — so a non-required field (whose unset representation is
 * `""`, per `defaultValueFor` in `use-form-fields.ts`) could never be returned to that state
 * before submit. `UNSET` is a sentinel item value mapped back to `""` in `onChange`; only
 * offered for non-required fields, mirroring `BooleanRenderer`'s "Clear" affordance for the
 * same problem on boolean fields.
 *
 * `UNSET` is never passed as the controlled `value` — an untouched or just-cleared field
 * always renders as `selected` (`undefined`), so the trigger shows the neutral "Select…"
 * placeholder rather than the `(none)` item's own label.
 */
const UNSET = "__unset__";

export function EnumRenderer({ field, value, onChange, error }: Readonly<EnumRendererProps>) {
  const { name, label, required, readOnly, description, optionsSource } = field;
  const options = resolveInlineOptions(optionsSource);
  const selected = typeof value === "string" && value !== "" ? value : undefined;
  const isRemote = optionsSource.kind === "remote";
  // Excluded for a remote options source — its options haven't loaded yet (the trigger is
  // disabled and shows "Options not yet loaded"), so there's nothing to clear back to "none" from.
  const canUnset = !required && !isRemote;

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      <Select
        value={selected}
        onValueChange={(next) => onChange(next === UNSET ? "" : next)}
        disabled={readOnly || isRemote}
      >
        <SelectTrigger
          id={name}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          <SelectValue placeholder={isRemote ? "Options not yet loaded" : "Select…"} />
        </SelectTrigger>
        {/* "popper" instead of the default "item-aligned": item-aligned positions the
        popup so the currently-highlighted item (the first one — "(none)" here, when
        nothing is selected) sits exactly under the trigger, so a plain open+close near
        that spot can register as a click on it and silently select "(none)". */}
        <SelectContent position="popper">
          {canUnset && <SelectItem value={UNSET}>(none)</SelectItem>}
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
