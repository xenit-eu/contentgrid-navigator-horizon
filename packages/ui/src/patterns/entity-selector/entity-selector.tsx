import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

export interface Entity {
  name: string;
  title: string;
}

export interface EntitySelectorProps {
  entities: readonly Entity[];
  selectedEntity?: Entity;
  onSelect: (entity: Entity) => void;
  label?: string;
}

export function EntitySelector({
  entities,
  selectedEntity,
  onSelect,
  label,
}: Readonly<EntitySelectorProps>) {
  if (entities.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <Select
        value={selectedEntity?.name}
        onValueChange={(name) => onSelect(entities.find((e) => e.name === name)!)}
      >
        <SelectTrigger className="h-8 w-48 text-sm" aria-label={label ?? "Select entity"}>
          <SelectValue placeholder="Select entity" />
        </SelectTrigger>
        <SelectContent>
          {entities.map((entity) => (
            <SelectItem key={entity.name} value={entity.name}>
              {entity.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
