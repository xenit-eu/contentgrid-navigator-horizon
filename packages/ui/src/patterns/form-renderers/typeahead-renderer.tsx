import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Input } from "../../primitives/input";

export interface TypeaheadRendererProps {
  readonly name: string;
  readonly value: string;
  /** Fires on every keystroke AND when a suggestion is clicked — both just set the query text. */
  readonly onChange: (value: string) => void;
  /** Distinct suggested values for the current `value` (e.g. from `useTypeahead`'s `results`). */
  readonly suggestions: readonly string[];
  readonly isLoading?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Required: this input renders no visible `<label>`, so an accessible name must come from here. */
  readonly "aria-label": string;
}

/**
 * Free-text input with a suggestions dropdown, backed by whatever data source the caller wires
 * up (typically `useTypeahead` — see that hook's doc comment). Descriptor-agnostic and
 * fetching-free like every other renderer here: `suggestions`/`isLoading` are supplied already
 * resolved (packages/ui/CLAUDE.md's "HAL-FORMS metadata in pattern components" rule).
 *
 * The dropdown opens on focus and closes on blur — closing is delayed one tick so a click on a
 * suggestion (which blurs the input first) still registers before the list unmounts.
 */
export function TypeaheadRenderer({
  name,
  value,
  onChange,
  suggestions,
  isLoading = false,
  placeholder,
  disabled = false,
  "aria-label": ariaLabel,
}: Readonly<TypeaheadRendererProps>) {
  const [open, setOpen] = useState(false);
  const showSuggestions = open && !disabled && (suggestions.length > 0 || isLoading);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listboxId = `${name}-suggestions`;

  useEffect(() => () => clearTimeout(closeTimeoutRef.current), []);

  return (
    <div className="relative">
      <Input
        id={name}
        name={name}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          closeTimeoutRef.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {showSuggestions && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${ariaLabel} suggestions`}
          className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {isLoading && suggestions.length === 0 && (
            <li
              role="option"
              aria-disabled="true"
              aria-selected={false}
              className="px-2 py-1.5 text-sm text-muted-foreground"
            >
              Loading…
            </li>
          )}
          {suggestions.map((suggestion) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={suggestion === value}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                suggestion === value && "bg-accent",
              )}
              // `onMouseDown` (not `onClick`) fires before the input's `onBlur`, so the click
              // registers here instead of being pre-empted by the blur-triggered close.
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(suggestion);
                setOpen(false);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
