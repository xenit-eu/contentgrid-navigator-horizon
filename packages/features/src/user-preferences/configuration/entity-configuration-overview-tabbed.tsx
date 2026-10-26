import { useState } from "react";
import { WrenchIcon } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  useLoadedProfileEntities,
  useNavigatorData,
} from "@contentgrid/navigator-data";
import {
  ENTITY_COLOR_THEMES,
  EntityCard,
  IconBadge,
  TabLink,
  TabbedLayout,
  ThemeSelector,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../../layout";
import { useEntityDisplayPreferencesStore } from "../entity-display-preferences-store";
import { EntityConfigurationDetail } from "./entity-configuration-detail";
import { type EntityConfigurationOverviewProps } from "./entity-configuration-overview";

/**
 * Alternate layout for the `~configuration` area. Same theme selector as
 * `EntityConfigurationOverview`, but instead of a card grid it uses a vertical `TabbedLayout`
 * — the same route-driven tab pattern `EntityConfigurationDetail` already uses for its own
 * preview tabs: entities on the left, that entity's `EntityConfigurationDetail` rendered
 * inline (`showInCard={false}`) on the right, so switching between entities doesn't navigate
 * away from the page. `onSelectEntity` still fires when a tab is clicked.
 */
export function EntityConfigurationOverviewTabbed({
  onSelectEntity,
}: Readonly<EntityConfigurationOverviewProps>) {
  const { profiles } = useLoadedProfileEntities();
  const { profileUrl } = useNavigatorData();
  const setOverride = useEntityDisplayPreferencesStore((state) => state.setOverride);
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(undefined);
  const [activeEntityName, setActiveEntityName] = useState<string | undefined>(undefined);

  function applyTheme() {
    const theme = ENTITY_COLOR_THEMES.find((candidate) => candidate.name === selectedTheme);
    if (!theme || theme.colors.length === 0) return;
    // Cycles through the theme's colors — duplicates allowed once entities outnumber colors.
    profiles.forEach((profile, index) => {
      setOverride(profileUrl, profile.name, { color: theme.colors[index % theme.colors.length] });
    });
  }

  const activeProfile: ProfileEntity | undefined =
    profiles.find((profile) => profile.name === activeEntityName) ?? profiles[0];

  return (
    <div className="space-y-6">
      {activeProfile && (
        <EntityCard
          name={"Configuration"}
          title={"Entity display"}
          icon={<IconBadge icon={<WrenchIcon size={32} />} />}
          description={
            "Customize how each entity's name, icon, and color are shown. Changes are saved to this browser and apply only to this backend."
          }
        >
          <ThemeSelector
            themes={ENTITY_COLOR_THEMES}
            value={selectedTheme}
            onValueChange={setSelectedTheme}
            onApply={applyTheme}
            applyDisabled={profiles.length === 0}
          />
          <TabbedLayout
            orientation="vertical"
            tabs={profiles.map((profile) => ({
              key: profile.name,
              label: profile.pluralName,
              active: profile.name === activeProfile.name,
            }))}
            renderTabLink={(tab, label) => {
              const profile = profiles.find((candidate) => candidate.name === tab.key);
              if (!profile) return null;
              return (
                <TabLink
                  key={tab.key}
                  href="#"
                  active={tab.active}
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveEntityName(tab.key);
                    onSelectEntity(profile);
                  }}
                >
                  <EntityIconBadge variant="sm" profile={profile} />
                  {label}
                </TabLink>
              );
            }}
          >
            <EntityConfigurationDetail profile={activeProfile} showInCard={false} />
          </TabbedLayout>
        </EntityCard>
      )}
    </div>
  );
}
