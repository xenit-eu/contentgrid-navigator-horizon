import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { FieldShell, fieldAriaProps } from "./field-shell";

/** A single selectable choice: `value` is the machine token submitted to the server, `label` is
 * the human-readable text shown to the user (the HAL-FORMS option's `prompt`). Kept distinct
 * because attribute/enum values are customer-defined machine tokens, not display text. */
export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

export interface EnumRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly options: readonly EnumOption[];
  /** True when the caller's options source is a remote link not yet resolved into `options` —
   * fetching stays out of `packages/ui` (see this package's CLAUDE.md), so the caller decides. */
  readonly isRemote?: boolean;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Radix `Select` disallows `value=""` on an item, and once a value is picked there's no
 * built-in way back to unselected — so a non-required field (whose unset representation is
 * `""`) could never be returned to that state before submit. `UNSET` is a sentinel item value
 * mapped back to `""` in `onChange`; only offered for non-required fields, mirroring
 * `BooleanRenderer`'s "Clear" affordance for the same problem on boolean fields.
 *
 * `UNSET` is never passed as the controlled `value` — an untouched or just-cleared field
 * always renders as `selected` (`undefined`), so the trigger shows the neutral "Select…"
 * placeholder rather than the `(none)` item's own label.
 */
const UNSET = "__unset__";

export function EnumRenderer({
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
  onFocus,
  onBlur,
}: Readonly<EnumRendererProps>) {
  const selected = typeof value === "string" && value !== "" ? value : undefined;
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
        <SelectTrigger id={name} onFocus={onFocus} onBlur={onBlur} {...fieldAriaProps(name, error)}>
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
