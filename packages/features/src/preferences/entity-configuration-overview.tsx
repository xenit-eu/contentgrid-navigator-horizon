import { useState } from "react";
import { GearIcon as Gear } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  useLoadedProfileEntities,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import {
  Alert,
  Button,
  ColorPicker,
  ENTITY_COLOR_THEMES,
  EntityCard,
  PageTitle,
  Skeleton,
  ThemeSelector,
} from "@contentgrid/ui";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { resolveEntityCardIcon } from "./resolve-entity-icon";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface EntityConfigurationOverviewProps {
  readonly onSelectEntity: (profile: ProfileEntity) => void;
}

/**
 * Entity selector for the `~configuration` area: a theme selector (bulk-assigns a color per
 * entity, cycling with duplicates allowed) above one `EntityCard` per discovered entity,
 * each showing its configured icon/color with a configuration (gear) action instead of the
 * dashboard's "create" action — selecting a card (title or gear) opens that entity's
 * configuration detail page.
 */
export function EntityConfigurationOverview({
  onSelectEntity,
}: Readonly<EntityConfigurationOverviewProps>) {
  const { profiles, isLoading } = useLoadedProfileEntities();
  const { profileUrl } = useNavigatorData();
  const setOverride = useEntityDisplayPreferencesStore((state) => state.setOverride);
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(undefined);
  const [showColorHint, setShowColorHint] = useState(true);

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
        header="Configuration"
        title="Entity display"
        subtitle="Customize how each entity's name, icon, and color are shown. Changes are saved to this browser and apply only to this backend."
      />
      {showColorHint && (
        <Alert onClose={() => setShowColorHint(false)}>
          Click on an entity icon to change its color or select a common theme with the theme
          selector.
        </Alert>
      )}
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={selectedTheme}
        onValueChange={setSelectedTheme}
        onApply={applyTheme}
        applyDisabled={profiles.length === 0}
      />

      {isLoading && profiles.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <p className="text-lg font-medium">No entities found</p>
          <p className="text-sm">Make sure your ContentGrid application has entities defined.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((profile) => (
            <EntityConfigurationCard
              key={profile.name}
              profile={profile}
              onSelect={() => onSelectEntity(profile)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityConfigurationCard({
  profile,
  onSelect,
}: Readonly<{ profile: ProfileEntity; onSelect: () => void }>) {
  const { preferences, setOverride } = useEntityDisplayPreferences(profile);
  const EntityIcon = resolveEntityCardIcon(preferences.icon);

  return (
    <EntityCard
      name={profile.name}
      title={profile.pluralName}
      description={profile.description || undefined}
      // The icon badge IS the color trigger: clicking it opens the color popover instead of
      // a separate swatch button — the badge's own color-mix styling (via EntityCard's
      // `color` prop below) doubles as the trigger's visual.
      icon={
        <ColorPicker
          value={preferences.color}
          onChange={(color) => setOverride({ color })}
          // Expands the trigger button to fill EntityCard's icon-badge padding (`p-2`), so
          // the whole colored badge is clickable — not just the icon glyph inside it.
          className="-m-2 p-0"
        >
          <EntityIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </ColorPicker>
      }
      color={preferences.color}
      onTitleClick={onSelect}
      action={
        <Button
          variant="ghost"
          size="icon"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <Gear className="h-4 w-4" aria-hidden />
          <span className="sr-only">Configure {profile.pluralName}</span>
        </Button>
      }
    />
  );
}
