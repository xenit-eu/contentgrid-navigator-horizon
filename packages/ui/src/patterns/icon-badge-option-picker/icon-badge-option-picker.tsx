import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import { Label } from "../../primitives/label";
import { ScrollArea } from "../../primitives/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

/** A single choice: a title with an optional icon (typically an `IconBadge`) and description. */
export interface IconBadgeOption {
  /** Unique key — used as the selection value. */
  name: string;
  title: string;
  description?: string;
  /** Rendered left of the title; the caller resolves it (e.g. from display preferences). */
  icon?: ReactNode;
}

export interface IconBadgeOptionPickerProps {
  options: readonly IconBadgeOption[];
  selectedOption?: IconBadgeOption;
  onSelect: (option: IconBadgeOption) => void;
  label?: string;
  /** Trigger text while nothing is selected; also the trigger's accessible name without `label`. */
  placeholder?: string;
  /**
   * Trigger height, mirroring `SelectTrigger`'s `size` (`"default"` → `h-9`, `"sm"` → `h-8`).
   * Pass `"sm"` for a compact, inline placement such as a toolbar.
   */
  size?: "sm" | "default";
}

function OptionCompactLabel({ option }: Readonly<{ option: IconBadgeOption }>) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.icon}
      <span className="truncate">{option.title}</span>
    </span>
  );
}

/** Named by its title alone; the description is announced as its description, not its name. */
function OptionItem({ option }: Readonly<{ option: IconBadgeOption }>) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <SelectItem
      value={option.name}
      textValue={option.title}
      aria-labelledby={titleId}
      aria-describedby={option.description ? descriptionId : undefined}
      className="[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
    >
      <div className="flex w-full min-w-0 items-center gap-2.5">
        {option.icon}
        <div className="flex min-w-0 flex-1 flex-col">
          <span id={titleId} className="truncate font-medium">
            {option.title}
          </span>
          {option.description && (
            <span id={descriptionId} className="text-muted-foreground truncate text-xs">
              {option.description}
            </span>
          )}
        </div>
      </div>
    </SelectItem>
  );
}

/**
 * A dropdown of options. Renders every option it is given, even just one or none — whether a
 * trivial choice is worth showing is the caller's decision.
 */
export function IconBadgeOptionPicker({
  options,
  selectedOption,
  onSelect,
  label,
  placeholder = "Select an option",
  size = "default",
}: Readonly<IconBadgeOptionPickerProps>) {
  const triggerId = useId();

  function handleValueChange(name: string) {
    const option = options.find((candidate) => candidate.name === name);
    if (option) onSelect(option);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={triggerId}>{label}</Label>}
      {/* `""` rather than `undefined` while nothing is selected keeps the Select controlled. */}
      <Select value={selectedOption?.name ?? ""} onValueChange={handleValueChange}>
        <SelectTrigger
          id={triggerId}
          size={size}
          fitContent
          className="w-full py-1.5"
          aria-label={label ? undefined : placeholder}
        >
          <SelectValue placeholder={placeholder}>
            {selectedOption && <OptionCompactLabel option={selectedOption} />}
          </SelectValue>
        </SelectTrigger>
        {/* Popper positioning keeps the list inside the viewport, even next to its right edge. */}
        <SelectContent position="popper" className="max-w-(--radix-select-content-available-width)">
          {options.map((option) => (
            <OptionItem key={option.name} option={option} />
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconBadgeOptionPickerList — inline list
// ---------------------------------------------------------------------------

export interface IconBadgeOptionPickerListProps {
  options: readonly IconBadgeOption[];
  selectedOption?: IconBadgeOption;
  onSelect: (option: IconBadgeOption) => void;
  /** Rendered above the list; names the radio group. */
  label: string;
}

interface OptionRowProps {
  option: IconBadgeOption;
  selected: boolean;
  tabbable: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef: (button: HTMLButtonElement | null) => void;
}

function OptionRow({
  option,
  selected,
  tabbable,
  onSelect,
  onKeyDown,
  buttonRef,
}: Readonly<OptionRowProps>) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className="group flex min-h-[74px] w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left transition-colors outline-none last:border-b-0 hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset aria-checked:bg-primary/10"
    >
      {option.icon && (
        <span className="transition-transform duration-200 group-hover:scale-110">
          {option.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{option.title}</span>
        {option.description && (
          <span className="truncate text-xs text-muted-foreground group-aria-checked:text-foreground/75">
            {option.description}
          </span>
        )}
      </span>
      {selected && <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />}
    </button>
  );
}

const ARROW_KEY_STEPS: Record<string, number> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

/**
 * The options laid out as an always-visible, scrollable list instead of a dropdown — for a page
 * whose main choice is this one, such as the Create Item page. Like the dropdown, it renders
 * every option it is given.
 *
 * A WAI-ARIA radio group: only one row is in the tab order (the selected one, else the first),
 * and the arrow keys move focus to the previous or next row and select it, wrapping at the ends.
 */
export function IconBadgeOptionPickerList({
  options,
  selectedOption,
  onSelect,
  label,
}: Readonly<IconBadgeOptionPickerListProps>) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.name === selectedOption?.name);
  const tabbableIndex = Math.max(selectedIndex, 0);

  function handleRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = ARROW_KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    buttons.current[nextIndex]?.focus();
    onSelect(options[nextIndex]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span
        id={labelId}
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {label}
      </span>
      {/*
        An overlay scrollbar, so the row hover and selection run the list's full width. The rows
        are the tab stops, so the viewport stays out of the tab order. Radix wraps the content in
        a `display: table` div, which grows to its widest row; `block` lets long rows truncate.
      */}
      <ScrollArea
        className="flex max-h-[min(296px,45vh)] flex-col overflow-hidden rounded-lg border bg-popover shadow-lg"
        viewportProps={{ tabIndex: -1, className: "max-h-[inherit] [&>div]:block!" }}
      >
        <div role="radiogroup" aria-labelledby={labelId}>
          {options.map((option, index) => (
            <OptionRow
              key={option.name}
              option={option}
              selected={index === selectedIndex}
              tabbable={index === tabbableIndex}
              onSelect={() => onSelect(option)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              buttonRef={(button) => {
                buttons.current[index] = button;
              }}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
