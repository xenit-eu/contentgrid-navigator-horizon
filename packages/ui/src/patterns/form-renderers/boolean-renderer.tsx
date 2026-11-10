import { type KeyboardEvent, useRef } from "react";
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
  /** `undefined` means unset (neither chip selected). */
  readonly value: boolean | undefined;
  readonly onChange: (value: boolean | undefined) => void;
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
 *
 * Exposed as a WAI-ARIA radio group ("one of two, or none"): the chips are `role="radio"`
 * inside a `role="radiogroup"` named by the visible label (`aria-labelledby` — a `<label
 * htmlFor>` can't point at a group), which also carries `aria-required`/`aria-invalid`. Like a
 * native radio group, only one chip is in the tab order (the checked one, else "True") and the
 * arrow keys move to and check the other chip. "Clear" unmounts once the value is unset, so it
 * hands focus back to the "True" chip instead of dropping it to `<body>`.
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
  const trueChipRef = useRef<HTMLButtonElement>(null);
  const falseChipRef = useRef<HTMLButtonElement>(null);
  const labelId = `${name}-label`;

  function select(next: boolean) {
    if (!readOnly) onChange(next);
  }

  function handleChipKeyDown(event: KeyboardEvent<HTMLButtonElement>, chip: boolean) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    // Two chips, so every arrow direction wraps to the other one.
    const next = !chip;
    (next ? trueChipRef : falseChipRef).current?.focus();
    select(next);
  }

  function clear() {
    onChange(undefined);
    trueChipRef.current?.focus();
  }

  return (
    <div className="space-y-1.5">
      <Label id={labelId}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      <div
        id={name}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required}
        className={cn("flex items-center gap-2", readOnly && "pointer-events-none opacity-50")}
        onFocus={onFocus}
        onBlur={onBlur}
        {...fieldAriaProps(name, error)}
      >
        <SelectionChip
          ref={trueChipRef}
          role="radio"
          label="True"
          size="sm"
          selected={value === true}
          tabIndex={value === false ? -1 : 0}
          onClick={() => select(true)}
          onKeyDown={(event) => handleChipKeyDown(event, true)}
          disabled={readOnly}
        />
        <SelectionChip
          ref={falseChipRef}
          role="radio"
          label="False"
          size="sm"
          selected={value === false}
          tabIndex={value === false ? 0 : -1}
          onClick={() => select(false)}
          onKeyDown={(event) => handleChipKeyDown(event, false)}
          disabled={readOnly}
        />
        {!readOnly && value !== undefined && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
