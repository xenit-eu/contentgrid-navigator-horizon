import { useState } from "react";
import {
  CalendarIcon,
  CaretDownIcon,
  ClockIcon,
  CubeIcon,
  HashIcon,
  PaperclipIcon,
  ShieldCheckIcon,
  TextAaIcon,
  ToggleLeftIcon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The attribute type, as surfaced by a `profileEntity`'s attributes.
 * `content` is not a distinct `ProfileAttributeType` on the wire — callers
 * should pass `"content"` when `ProfileAttribute.isContent` is true, and the
 * attribute's own `type` (e.g. `"string"`) otherwise.
 */
export type ProfileAttributeOptionType =
  | "string"
  | "long"
  | "double"
  | "boolean"
  | "date"
  | "datetime"
  | "object"
  | "content";

/** A single selectable `profileAttribute`, reduced to what this primitive renders. */
export interface ProfileAttributeOption {
  /** Attribute name — used as the selection value. */
  name: string;
  /** Display title; falls back to `name` when absent. */
  title?: string;
  description?: string;
  type: ProfileAttributeOptionType;
  /**
   * True for system-managed audit attributes (created-date, created-by,
   * modified-date, modified-by). Rendered in a separate "System attributes"
   * group.
   */
  isSystem?: boolean;
}

// ---------------------------------------------------------------------------
// Type icon
// ---------------------------------------------------------------------------

const ATTRIBUTE_TYPE_ICONS: Record<ProfileAttributeOptionType, typeof TextAaIcon> = {
  string: TextAaIcon,
  long: HashIcon,
  double: HashIcon,
  boolean: ToggleLeftIcon,
  date: CalendarIcon,
  datetime: ClockIcon,
  object: CubeIcon,
  content: PaperclipIcon,
};

function AttributeTypeIcon({
  type,
  className,
}: Readonly<{ type: ProfileAttributeOptionType; className?: string }>) {
  const Icon = ATTRIBUTE_TYPE_ICONS[type];
  return <Icon className={cn("text-muted-foreground size-4 shrink-0", className)} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Shared row content
// ---------------------------------------------------------------------------

function groupOptions(options: readonly ProfileAttributeOption[]) {
  return {
    attributes: options.filter((option) => !option.isSystem),
    systemAttributes: options.filter((option) => option.isSystem),
  };
}

function AttributeOptionCompactLabel({ option }: Readonly<{ option: ProfileAttributeOption }>) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AttributeTypeIcon type={option.type} />
      <span className="truncate">{option.title ?? option.name}</span>
    </span>
  );
}

function AttributeOptionLabel({ option }: Readonly<{ option: ProfileAttributeOption }>) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <AttributeTypeIcon type={option.type} className="mt-0.5" />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{option.title ?? option.name}</span>
          <Badge variant="outline" className="text-muted-foreground font-normal">
            {option.type}
          </Badge>
        </div>
        {option.description && (
          <span className="text-muted-foreground truncate text-xs">{option.description}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttributeSelect — single select
// ---------------------------------------------------------------------------

export interface AttributeSelectProps {
  /** Attributes available for selection, from `profileEntity.attributes`. */
  attributes: readonly ProfileAttributeOption[];
  /** Currently selected attribute name. */
  value?: string;
  onSelect: (attribute: ProfileAttributeOption) => void;
  placeholder?: string;
  label?: string;
}

export function AttributeSelect({
  attributes,
  value,
  onSelect,
  placeholder = "Select attribute",
  label,
}: Readonly<AttributeSelectProps>) {
  const { attributes: regular, systemAttributes } = groupOptions(attributes);
  const selectedOption = attributes.find((option) => option.name === value);

  function handleValueChange(name: string) {
    const attribute = attributes.find((option) => option.name === name);
    if (attribute) onSelect(attribute);
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="h-9 w-64" aria-label={label ?? placeholder}>
          <SelectValue placeholder={placeholder}>
            {selectedOption && <AttributeOptionCompactLabel option={selectedOption} />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {regular.length > 0 && (
            <SelectGroup>
              {regular.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  <AttributeOptionLabel option={option} />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {systemAttributes.length > 0 && (
            <>
              {regular.length > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1">
                  <ShieldCheckIcon className="size-3.5" aria-hidden />
                  System attributes
                </SelectLabel>
                {systemAttributes.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    <AttributeOptionLabel option={option} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttributeMultiSelect — multi select
// ---------------------------------------------------------------------------

export interface AttributeMultiSelectProps {
  /** Attributes available for selection, from `profileEntity.attributes`. */
  attributes: readonly ProfileAttributeOption[];
  /** Currently selected attribute names. */
  values: readonly string[];
  onChange: (names: readonly string[]) => void;
  placeholder?: string;
  label?: string;
}

function AttributeCheckboxRow({
  option,
  checked,
  onToggle,
}: Readonly<{
  option: ProfileAttributeOption;
  checked: boolean;
  onToggle: (name: string) => void;
}>) {
  const inputId = `attribute-multiselect-${option.name}`;
  return (
    <label
      htmlFor={inputId}
      className="hover:bg-accent flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm"
    >
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={() => onToggle(option.name)}
        className="mt-0.5"
      />
      <AttributeOptionLabel option={option} />
    </label>
  );
}

export function AttributeMultiSelect({
  attributes,
  values,
  onChange,
  placeholder = "Select attributes",
  label,
}: Readonly<AttributeMultiSelectProps>) {
  const [open, setOpen] = useState(false);
  const { attributes: regular, systemAttributes } = groupOptions(attributes);
  const selected = new Set(values);

  function toggle(name: string) {
    if (selected.has(name)) {
      onChange(values.filter((value) => value !== name));
    } else {
      onChange([...values, name]);
    }
  }

  let triggerText: string;
  if (selected.size === 0) {
    triggerText = placeholder;
  } else if (selected.size === 1) {
    const option = attributes.find((attribute) => selected.has(attribute.name));
    triggerText = option?.title ?? option?.name ?? placeholder;
  } else {
    triggerText = `${selected.size} attributes selected`;
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label ?? placeholder}
            className="h-9 w-64 justify-between font-normal"
          >
            <span className={cn("truncate", selected.size === 0 && "text-muted-foreground")}>
              {triggerText}
            </span>
            <CaretDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1" align="start">
          <div className="max-h-80 overflow-x-hidden overflow-y-auto">
            {regular.length > 0 && (
              <div className="flex flex-col">
                {regular.map((option) => (
                  <AttributeCheckboxRow
                    key={option.name}
                    option={option}
                    checked={selected.has(option.name)}
                    onToggle={toggle}
                  />
                ))}
              </div>
            )}
            {systemAttributes.length > 0 && (
              <>
                {regular.length > 0 && <div className="bg-border -mx-1 my-1 h-px" />}
                <div className="text-muted-foreground flex items-center gap-1 px-2 py-1.5 text-xs">
                  <ShieldCheckIcon className="size-3.5" aria-hidden />
                  System attributes
                </div>
                <div className="flex flex-col">
                  {systemAttributes.map((option) => (
                    <AttributeCheckboxRow
                      key={option.name}
                      option={option}
                      checked={selected.has(option.name)}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
