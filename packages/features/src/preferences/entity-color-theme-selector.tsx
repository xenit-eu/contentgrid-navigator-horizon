import { useState } from "react";
import { type ProfileEntity, useNavigatorData } from "@contentgrid/navigator-data";
import { ENTITY_COLOR_THEMES, ThemeSelector } from "@contentgrid/ui";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";

export interface EntityColorThemeSelectorProps {
  /** The entities a theme is applied to, in order. */
  readonly profiles: readonly ProfileEntity[];
}

/**
 * Picks one of the common color themes and, on Apply, gives every entity in `profiles` a color
 * from it — cycling through the theme's colors, duplicates allowed once entities outnumber them.
 */
export function EntityColorThemeSelector({ profiles }: Readonly<EntityColorThemeSelectorProps>) {
  const { profileUrl } = useNavigatorData();
  const setOverride = useEntityDisplayPreferencesStore((state) => state.setOverride);
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(undefined);

  function applyTheme() {
    const theme = ENTITY_COLOR_THEMES.find((candidate) => candidate.name === selectedTheme);
    if (!theme || theme.colors.length === 0) return;
    profiles.forEach((profile, index) => {
      setOverride(profileUrl, profile.name, { color: theme.colors[index % theme.colors.length] });
    });
  }

  return (
    <ThemeSelector
      themes={ENTITY_COLOR_THEMES}
      value={selectedTheme}
      onValueChange={setSelectedTheme}
      onApply={applyTheme}
      applyDisabled={profiles.length === 0}
    />
  );
}
