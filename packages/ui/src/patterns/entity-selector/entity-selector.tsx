import type { ReactNode } from "react";
import { Label } from "../../primitives/label";
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
        <SelectTrigger size={size} className="w-full" aria-label={label ?? "Select entity"}>
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
