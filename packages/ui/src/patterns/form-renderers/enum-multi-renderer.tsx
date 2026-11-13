import { useState } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Chip } from "../../primitives/chip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import type { EnumOption } from "./enum-renderer";
import { FieldShell, fieldAriaProps } from "./field-shell";

export interface EnumMultiRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly value: readonly string[] | undefined;
  readonly onChange: (value: string[]) => void;
  readonly error?: string;
  readonly options: readonly EnumOption[];
  /** True when the caller's options source is a remote link not yet resolved into `options`. */
  readonly isRemote?: boolean;
  /** Most values that can be selected; unselected options are disabled once it is reached. */
  readonly maxItems?: number;
}

/**
 * Multi-select combobox (shadcn Popover + Command): the trigger shows the selected values as
 * chips; the popover lists every option with a search field, and picking an option toggles it
 * while the popover stays open.
 */
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
  maxItems = Infinity,
}: Readonly<EnumMultiRendererProps>) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];
  const atMax = selected.length >= maxItems;

  function toggle(optionValue: string) {
    onChange(
      selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue],
    );
  }

  // A selected value that is not (or no longer) an option still shows, by its raw value.
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={name}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              disabled={readOnly}
              {...fieldAriaProps(name, error)}
              className={cn(
                "border-input dark:bg-input/30 dark:hover:bg-input/50 flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {selected.length > 0 ? (
                <span className="flex min-w-0 flex-wrap gap-1">
                  {selected.map((v) => (
                    <Chip key={v} label={labelOf(v)} className="py-0.5" />
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">Select…</span>
              )}
              <CaretDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            {/* cmdk names its input after `label` and its list after the list's own `label`. */}
            <Command label={`Search ${label}`}>
              <CommandInput placeholder="Search…" />
              <CommandList label={label} aria-multiselectable>
                <CommandEmpty>No matches</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        keywords={[option.label]}
                        disabled={!isSelected && atMax}
                        aria-checked={isSelected}
                        data-checked={isSelected}
                        onSelect={() => toggle(option.value)}
                      >
                        <CheckIcon
                          className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")}
                          aria-hidden
                        />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </FieldShell>
  );
}
