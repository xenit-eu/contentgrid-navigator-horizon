import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

export interface Profile {
  name: string;
  title: string;
}

export interface ProfileSelectorProps {
  profiles: readonly Profile[];
  selectedProfile?: Profile;
  onSelect: (profile: Profile) => void;
  /** Optional text label rendered before the selector (e.g. "Entity" in the create flow). */
  label?: string;
}

export function ProfileSelector({
  profiles,
  selectedProfile,
  onSelect,
  label,
}: Readonly<ProfileSelectorProps>) {
  if (profiles.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <Select
        value={selectedProfile?.name}
        onValueChange={(name) => {
          const profile = profiles.find((p) => p.name === name);
          if (profile) onSelect(profile);
        }}
      >
        <SelectTrigger className="h-8 w-48 text-sm" aria-label={label ?? "Select profile"}>
          <SelectValue placeholder="Select profile" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((profile) => (
            <SelectItem key={profile.name} value={profile.name}>
              {profile.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
