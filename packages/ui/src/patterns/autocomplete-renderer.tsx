import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { cn } from "../lib/utils";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/popover";
import { FieldMessage, RequiredMarker, fieldAriaProps } from "./form-renderers/field-shell";

export interface AutocompleteRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** The committed value — only ever updated through `onChange`, never while typing. */
  readonly value: FieldValue;
  /** Fires only on commit: selecting a suggestion, pressing Enter, or leaving the field — never
   * per keystroke, so a search form doesn't refetch its collection for every half-typed value. */
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /** Matching suggestions for the current query — supplied by the caller (e.g. the feature layer
   * calling `useTypeahead`), never fetched by this component. */
  readonly suggestions: readonly string[];
  readonly isLoading?: boolean;
  /** Fires on every keystroke so the caller can (typically, debounced) re-fetch `suggestions`. */
  readonly onQueryChange: (query: string) => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Suggest-as-you-type field kind (FR-017), descriptor-agnostic per `packages/ui/CLAUDE.md` —
 * takes only plain scalar props, never fetches its own suggestions. Extracted from
 * `filter-sidebar.tsx`'s existing inline `TypeaheadTextFilter` combobox (`Popover` + `Input` +
 * `aria-autocomplete="list"` + arrow/enter/escape keyboard nav) into a standalone pattern other
 * forms can reuse, wrapped in the same label/description/error chrome every other renderer in
 * `form-renderers/` uses (`FieldShell`'s pieces).
 *
 * Keeps that filter's draft/commit split: `typedValue` is what's in the input box, updated on
 * every keystroke alongside `onQueryChange` (for suggestions), while `value` is the committed
 * value, pushed through `onChange` only by `commit` — on selecting a suggestion, Enter, or
 * blur. Escape reverts the draft to `value`. Committing also resets the query, so the
 * suggestions query never ends up scoped to exactly the committed value (which would encode to
 * the same request as the caller's own filtered collection query).
 */
export function AutocompleteRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  suggestions,
  isLoading = false,
  onQueryChange,
  onFocus,
  onBlur,
}: Readonly<AutocompleteRendererProps>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const committedValue = typeof value === "string" ? value : "";
  const [typedValue, setTypedValue] = useState(committedValue);

  // Follow the committed value when it changes from outside (e.g. "Clear all", a deep link) —
  // typing never changes it, so this doesn't clobber a draft in progress.
  useEffect(() => {
    setTypedValue(committedValue);
  }, [committedValue]);

  // While a new query loads, `suggestions` can still hold the previous query's results — treat
  // them as not actionable, so neither the list nor keyboard nav can pick a stale suggestion.
  const visibleSuggestions = isLoading ? [] : suggestions;
  const hasSuggestions = visibleSuggestions.length > 0;
  const showPopover = open && (hasSuggestions || isLoading);

  function closePopover() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function commit(next: string) {
    if (next !== committedValue) onChange(next);
    onQueryChange("");
  }

  function selectSuggestion(suggestion: string) {
    setTypedValue(suggestion);
    commit(suggestion);
    closePopover();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        if (!hasSuggestions) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % visibleSuggestions.length);
        break;
      case "ArrowUp":
        if (!hasSuggestions) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? visibleSuggestions.length - 1 : i - 1));
        break;
      case "Enter":
        event.preventDefault();
        if (hasSuggestions && activeIndex >= 0) {
          selectSuggestion(visibleSuggestions[activeIndex]);
        } else {
          commit(typedValue);
          closePopover();
        }
        break;
      case "Escape":
        setTypedValue(committedValue);
        onQueryChange("");
        closePopover();
        break;
      default:
        break;
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      <Popover open={showPopover} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            id={name}
            name={name}
            role="combobox"
            aria-expanded={showPopover}
            aria-autocomplete="list"
            autoComplete="off"
            value={typedValue}
            readOnly={readOnly}
            required={required}
            onChange={(event) => {
              const nextValue = event.target.value;
              setTypedValue(nextValue);
              onQueryChange(nextValue);
              setOpen(!!nextValue);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              onFocus?.();
              if (hasSuggestions) setOpen(true);
            }}
            onBlur={() => {
              commit(typedValue);
              closePopover();
              onBlur?.();
            }}
            {...fieldAriaProps(name, error)}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
        >
          {isLoading && <p className="py-2 text-center text-sm text-muted-foreground">Loading…</p>}
          {!isLoading &&
            visibleSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={cn(
                  "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
        </PopoverContent>
      </Popover>
      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
