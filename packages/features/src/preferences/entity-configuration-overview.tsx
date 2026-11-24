import { type ReactNode, useState } from "react";
import { WrenchIcon } from "@phosphor-icons/react";
import {
  type ProfileAttribute,
  type ProfileEntity,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import {
  Alert,
  Button,
  EntityCard,
  EntityCardDescription,
  EntityCardGrid,
  EntityCardSkeleton,
  EntityCardText,
  EntityCardTitle,
  IconBadge,
  IconColorPickerContent,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";
import { EntityColorThemeSelector } from "./entity-color-theme-selector";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface EntityConfigurationOverviewProps {
  readonly onSelectEntity: (profile: ProfileEntity) => void;
}

/**
 * Entity selector for the `~configuration` area: a theme selector (bulk-assigns a color per
 * entity, cycling with duplicates allowed) above one card per discovered entity. A card's icon
 * opens the icon and color picker, a line sums up its display settings, and "Configure" opens
 * that entity's configuration page.
 */
export function EntityConfigurationOverview({
  onSelectEntity,
}: Readonly<EntityConfigurationOverviewProps>) {
  const { profiles, isLoading } = useLoadedProfileEntities();
  const [showColorHint, setShowColorHint] = useState(true);

  let content: ReactNode;
  if (isLoading && profiles.length === 0) {
    content = (
      <EntityCardGrid>
        {[1, 2, 3, 4].map((i) => (
          <EntityCardSkeleton key={i} className="h-28" />
        ))}
      </EntityCardGrid>
    );
  } else if (profiles.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">No entities found</p>
        <p className="text-sm">Make sure your ContentGrid application has entities defined.</p>
      </div>
    );
  } else {
    content = (
      <EntityCardGrid>
        {profiles.map((profile) => (
          <EntityConfigurationCard
            key={profile.name}
            profile={profile}
            onSelect={() => onSelectEntity(profile)}
          />
        ))}
      </EntityCardGrid>
    );
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
      <EntityColorThemeSelector profiles={profiles} />

      {content}
    </div>
  );
}

export function EntityConfigurationCard({
  profile,
  onSelect,
}: Readonly<{ profile: ProfileEntity; onSelect: () => void }>) {
  const { preferences, nameAttribute, subtitleAttribute, hasNamingOverride, setOverride } =
    useEntityDisplayPreferences(profile);

  return (
    <EntityCard className="flex-row items-start">
      <Popover>
        <PopoverTrigger asChild>
          {/* The asChild target must be a real DOM element so Radix can anchor/position
              the popover off it — EntityIconBadge/IconBadge don't forward refs, so they
              can't be the target directly. A plain button wrapping the (non-interactive)
              badge mirrors ColorPicker's own custom-trigger pattern. */}
          <button
            type="button"
            aria-label={`Change icon and color for ${profile.pluralName}`}
            className="inline-flex shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <EntityIconBadge profile={profile} tinted />
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
      <EntityCardText className="flex-1">
        <EntityCardTitle>{profile.pluralName}</EntityCardTitle>
        <EntityCardDescription>
          {hasNamingOverride
            ? describeTitleAndSubtitle(nameAttribute, subtitleAttribute)
            : "Defaults"}
        </EntityCardDescription>
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0 text-ui font-semibold"
          aria-label={`Configure ${profile.pluralName}`}
          onClick={onSelect}
        >
          Configure
        </Button>
      </EntityCardText>
    </EntityCard>
  );
}

/** "Title: Reference · Subtitle: Supplier": which attributes name the entity's items. */
function describeTitleAndSubtitle(
  nameAttribute: ProfileAttribute | undefined,
  subtitleAttribute: ProfileAttribute | undefined,
) {
  const title = nameAttribute ? `Title: ${attributeLabel(nameAttribute)}` : "No title";
  const subtitle = subtitleAttribute
    ? `Subtitle: ${attributeLabel(subtitleAttribute)}`
    : "No subtitle";
  return `${title} · ${subtitle}`;
}

function attributeLabel(attribute: ProfileAttribute) {
  return attribute.title ?? attribute.name;
}
