import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

interface ProfileEntityOption {
  name: string;
  title: string;
}

export interface ProfileEntitySelectorProps {
  entities: readonly ProfileEntityOption[];
  selectedEntity?: ProfileEntityOption;
  onSelect: (entity: ProfileEntityOption) => void;
  label?: string;
}

export function ProfileEntitySelector({
  entities,
  selectedEntity,
  onSelect,
  label,
}: Readonly<ProfileEntitySelectorProps>) {
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
