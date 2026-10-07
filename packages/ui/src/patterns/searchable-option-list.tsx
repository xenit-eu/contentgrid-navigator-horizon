import { type KeyboardEvent, useId, useState } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import { filterOptionsByPrefix } from "../lib/filter-options";
import { cn } from "../lib/utils";
import { Input } from "../primitives/input";

export interface SearchableOptionListProps {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: string | undefined;
  readonly onValueChange: (value: string) => void;
  readonly searchPlaceholder?: string;
  readonly emptyLabel?: string;
  /** Accessible name of the list. */
  readonly label?: string;
  readonly autoFocus?: boolean;
  readonly className?: string;
}

/**
 * A single-select list with a search field above it. Typing narrows the list at once, on the
 * client (`filterOptionsByPrefix`), with no debounce. Focus stays in the search field; arrow
 * keys move the highlight and Enter picks it (WAI-ARIA combobox with `aria-activedescendant`).
 */
export function SearchableOptionList({
  options,
  value,
  onValueChange,
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  label = "Options",
  autoFocus = false,
  className,
}: Readonly<SearchableOptionListProps>) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const visible = filterOptionsByPrefix(options, query);
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const listboxId = `${baseId}-listbox`;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (visible.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      const picked = visible[activeIndex >= 0 ? activeIndex : 0];
      if (picked && (activeIndex >= 0 || visible.length === 1)) {
        event.preventDefault();
        onValueChange(picked.value);
      }
    }
  }

  return (
    <div data-slot="searchable-option-list" className={cn("flex flex-col gap-1", className)}>
      <Input
        type="text"
        role="combobox"
        aria-label={`Search ${label.toLocaleLowerCase()}`}
        aria-expanded={visible.length > 0}
        aria-controls={visible.length > 0 ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && activeIndex < visible.length ? optionId(activeIndex) : undefined
        }
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={searchPlaceholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="h-8"
      />
      {visible.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div
          id={listboxId}
          role="listbox" // NOSONAR: no native-element alternative for a filterable, custom-styled list
          aria-label={label}
          className="scrollbar-subtle max-h-60 overflow-y-auto"
        >
          {visible.map((option, index) => {
            const selected = option.value === value;
            return (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onValueChange(option.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
              >
                <CheckIcon
                  size={14}
                  aria-hidden
                  className={cn("shrink-0", !selected && "invisible")}
                />
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
