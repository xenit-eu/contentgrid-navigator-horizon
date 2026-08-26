import { useState } from "react";
import { GearIcon as Gear, WrenchIcon } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  useLoadedProfileEntities,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import {
  Alert,
  Button,
  ENTITY_COLOR_THEMES,
  EntityCard,
  IconBadge,
  IconColorPickerContent,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  ThemeSelector,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../../layout";
import { useEntityDisplayPreferencesStore } from "../entity-display-preferences-store";
import { useEntityDisplayPreferences } from "../use-entity-display-preferences";

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
        icon={<IconBadge icon={<WrenchIcon size={32} />} />}
        subtitle="Customize how each entity's name, icon, and color are shown. Changes are saved to this browser and apply only to this backend."
      />
      {showColorHint && (
        <Alert onClose={() => setShowColorHint(false)}>
          Click on an entity icon to change its icon or color, or select a common theme with the
          theme selector.
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
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-2 md:grid-cols-4">
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
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-2 md:grid-cols-4">
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

  return (
    <EntityCard
      name={profile.name}
      title={profile.pluralName}
      description={profile.description || undefined}
      icon={
        <Popover>
          <PopoverTrigger asChild>
            {/* The asChild target must be a real DOM element so Radix can anchor/position
                the popover off it — EntityIconBadge/IconBadge don't forward refs, so they
                can't be the target directly. A plain button wrapping the (non-interactive)
                badge mirrors ColorPicker's own custom-trigger pattern. */}
            <button
              type="button"
              aria-label={`Change icon and color for ${profile.pluralName}`}
              className="inline-flex cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <EntityIconBadge variant="sm" profile={profile} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <IconColorPickerContent
              icon={preferences.icon}
              onIconChange={(icon) => setOverride({ icon })}
              color={preferences.color}
              onColorChange={(color) => setOverride({ color })}
            />
          </PopoverContent>
        </Popover>
      }
      onCardClick={onSelect}
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
