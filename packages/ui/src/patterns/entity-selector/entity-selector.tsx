import { type ReactNode, useId } from "react";
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

/** A single selectable `profileEntity`, reduced to what this pattern renders. */
export interface ProfileEntityOption {
  /** Entity name — used as the selection value. */
  name: string;
  title: string;
  description?: string;
  /** Rendered left of the title; the caller resolves it (e.g. from display preferences). */
  icon?: ReactNode;
}

export interface ProfileEntitySelectorProps {
  entities: readonly ProfileEntityOption[];
  selectedEntity?: ProfileEntityOption;
  onSelect: (entity: ProfileEntityOption) => void;
  label?: string;
  /**
   * Trigger height, mirroring `SelectTrigger`'s `size` (`"default"` → `h-9`, `"sm"` → `h-8`).
   * Pass `"sm"` for a compact, inline placement such as a toolbar.
   */
  size?: "sm" | "default";
}

function EntityOptionCompactLabel({ option }: Readonly<{ option: ProfileEntityOption }>) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.icon}
      <span className="truncate">{option.title}</span>
    </span>
  );
}

function EntityOptionLabel({ option }: Readonly<{ option: ProfileEntityOption }>) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      {option.icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{option.title}</span>
        {option.description && (
          <span className="text-muted-foreground truncate text-xs">{option.description}</span>
        )}
      </div>
    </div>
  );
}

export function ProfileEntitySelector({
  entities,
  selectedEntity,
  onSelect,
  label,
  size = "default",
}: Readonly<ProfileEntitySelectorProps>) {
  function handleValueChange(name: string) {
    const entity = entities.find((option) => option.name === name);
    if (entity) onSelect(entity);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label>{label}</Label>}
      <Select value={selectedEntity?.name} onValueChange={handleValueChange}>
        <SelectTrigger
          size={size}
          // Grows past the fixed trigger height so an icon badge keeps vertical padding.
          className="w-full py-1.5 data-[size=default]:h-auto data-[size=default]:min-h-9 data-[size=sm]:h-auto data-[size=sm]:min-h-8"
          aria-label={label ?? "Select entity"}
        >
          <SelectValue placeholder="Select entity">
            {selectedEntity && <EntityOptionCompactLabel option={selectedEntity} />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {entities.map((option) => (
            <SelectItem
              key={option.name}
              value={option.name}
              className="[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
            >
              <EntityOptionLabel option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileEntitySelectorList — inline list
// ---------------------------------------------------------------------------

export interface ProfileEntitySelectorListProps {
  entities: readonly ProfileEntityOption[];
  selectedEntity?: ProfileEntityOption;
  onSelect: (entity: ProfileEntityOption) => void;
  /** Rendered above the list; names the radio group. */
  label: string;
}

function EntityOptionRow({
  option,
  selected,
  onSelect,
}: Readonly<{ option: ProfileEntityOption; selected: boolean; onSelect: () => void }>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
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

/**
 * The entity options laid out as an always-visible, scrollable list instead of a dropdown — for
 * a page whose main choice is the entity, such as the Create Item page.
 */
export function ProfileEntitySelectorList({
  entities,
  selectedEntity,
  onSelect,
  label,
}: Readonly<ProfileEntitySelectorListProps>) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <span
        id={labelId}
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {label}
      </span>
      {/* An overlay scrollbar, so the row hover and selection run the list's full width. */}
      <ScrollArea className="flex max-h-[min(296px,45vh)] flex-col overflow-hidden rounded-lg border bg-popover shadow-lg [&>[data-slot=scroll-area-viewport]]:max-h-[inherit] [&>[data-slot=scroll-area-viewport]>div]:block!">
        <div role="radiogroup" aria-labelledby={labelId}>
          {entities.map((option) => (
            <EntityOptionRow
              key={option.name}
              option={option}
              selected={option.name === selectedEntity?.name}
              onSelect={() => onSelect(option)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
