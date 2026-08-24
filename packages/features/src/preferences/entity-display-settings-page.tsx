import { useState } from "react";
import {
  type ProfileEntity,
  useLoadedProfileEntities,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  ColorPicker,
  ENTITY_COLOR_THEMES,
  IconPicker,
  Label,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ThemeSelector,
} from "@contentgrid/ui";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

/**
 * Settings page: lets the current user override each entity's display preferences
 * (name attribute, icon, color) on top of the backend/heuristic defaults. Overrides are
 * persisted per-backend in the browser — see `useEntityDisplayPreferencesStore`.
 */
export function EntityDisplaySettingsPage() {
  const { profiles, isLoading } = useLoadedProfileEntities();
  const { profileUrl } = useNavigatorData();
  const setOverride = useEntityDisplayPreferencesStore((state) => state.setOverride);
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(undefined);

  function applyTheme() {
    const theme = ENTITY_COLOR_THEMES.find((candidate) => candidate.name === selectedTheme);
    if (!theme || theme.colors.length === 0) return;
    // Cycles through the theme's colors — duplicates allowed once entities outnumber colors.
    profiles.forEach((profile, index) => {
      setOverride(profileUrl, profile.name, { color: theme.colors[index % theme.colors.length] });
    });
  }

  return (
    <div className="space-y-6">
      <PageTitle
        header="Settings"
        title="Entity display"
        subtitle="Customize how each entity's name, icon, and color are shown. Changes are saved to this browser and apply only to this backend."
      />

      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={selectedTheme}
        onValueChange={setSelectedTheme}
        onApply={applyTheme}
        applyDisabled={profiles.length === 0}
      />

      {isLoading && profiles.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((profile) => (
            <EntityDisplayPreferencesCard key={profile.name} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityDisplayPreferencesCard({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const { preferences, setOverride } = useEntityDisplayPreferences(profile);
  const nameAttributeOptions = [profile.idAttribute, ...profile.userDefinedAttributes];
  const nameAttributeFieldId = `${profile.name}-name-attribute`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.pluralName}</CardTitle>
        <CardAction>
          <ColorPicker value={preferences.color} onChange={(color) => setOverride({ color })} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={nameAttributeFieldId}>Name attribute</Label>
          <Select
            value={preferences.nameAttribute}
            onValueChange={(value) => setOverride({ nameAttribute: value })}
          >
            <SelectTrigger id={nameAttributeFieldId} className="w-full">
              <SelectValue placeholder="Choose attribute" />
            </SelectTrigger>
            <SelectContent>
              {nameAttributeOptions.map((attribute) => (
                <SelectItem key={attribute.name} value={attribute.name}>
                  {attribute.title ?? attribute.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Icon</Label>
          <IconPicker value={preferences.icon} onChange={(icon) => setOverride({ icon })} />
        </div>
      </CardContent>
    </Card>
  );
}
