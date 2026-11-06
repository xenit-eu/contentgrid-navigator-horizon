import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Chip } from "../../primitives/chip";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface TextMultiRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: readonly string[] | undefined;
  readonly onChange: (value: string[]) => void;
  readonly error?: string;
  /** Most values that can be entered; the input is disabled once it is reached. */
  readonly maxItems?: number;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

function placeholderFor(count: number, maxItems: number): string {
  if (count >= maxItems) return `Maximum of ${maxItems} values`;
  return count === 0 ? "Type a value and press Enter" : "Add another…";
}

/**
 * Free-text multi-value field (a multi-valued property without predefined options): every value is
 * a removable chip, followed by an input. Enter adds the typed value; pasting several lines adds
 * one value per line; Backspace in the empty input removes the last value; leaving the field adds
 * whatever is still typed. Values are trimmed, and empty or duplicate values are ignored.
 */
export function TextMultiRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  maxItems = Infinity,
  onFocus,
  onBlur,
}: Readonly<TextMultiRendererProps>) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const values = value ?? [];
  const atMax = values.length >= maxItems;
  const hintId = `${name}-hint`;

  function add(candidates: readonly string[]) {
    const next = [...values];
    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (trimmed === "" || next.includes(trimmed)) continue;
      if (next.length >= maxItems) break;
      next.push(trimmed);
    }
    if (next.length !== values.length) onChange(next);
  }

  function remove(item: string) {
    onChange(values.filter((v) => v !== item));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Never submit the surrounding form from here.
      event.preventDefault();
      add([draft]);
      setDraft("");
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/\r?\n/.test(text)) return;
    event.preventDefault();
    add([draft, ...text.split(/\r?\n/)]);
    setDraft("");
  }

  function handleBlur() {
    if (draft.trim() !== "") {
      add([draft]);
      setDraft("");
    }
    onBlur?.();
  }

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
    >
      {/* The input grows to fill the rest of the box, so a click on the empty part lands in it. */}
      <div
        data-slot="text-multi"
        data-invalid={!!error || undefined}
        className={cn(
          "border-input dark:bg-input/30 flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-1.5 py-1 text-sm shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          "data-[invalid]:border-destructive data-[invalid]:ring-destructive/20 dark:data-[invalid]:ring-destructive/40",
        )}
      >
        {values.map((item) => (
          <Chip
            key={item}
            label={item}
            removable={!readOnly}
            onRemove={() => remove(item)}
            removeLabel={`Remove ${item}`}
            className="py-0.5"
          />
        ))}
        {!readOnly && (
          <input
            ref={inputRef}
            id={name}
            name={name}
            type="text"
            value={draft}
            disabled={atMax}
            placeholder={placeholderFor(values.length, maxItems)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={onFocus}
            onBlur={handleBlur}
            {...fieldAriaProps(name, error)}
            aria-describedby={[hintId, fieldAriaProps(name, error)["aria-describedby"]]
              .filter(Boolean)
              .join(" ")}
            className="placeholder:text-muted-foreground h-7 min-w-24 flex-1 bg-transparent px-1.5 outline-none disabled:cursor-not-allowed"
          />
        )}
        {readOnly && values.length === 0 && <span className="px-1.5 text-muted-foreground">—</span>}
      </div>
      <span id={hintId} className="sr-only">
        Press Enter to add a value. Backspace removes the last value.
      </span>
    </FieldShell>
  );
}
