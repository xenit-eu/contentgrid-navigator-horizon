import type { ProfileEntity } from "@contentgrid/navigator-data";
import { ColorPicker } from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

export interface EntityColorBadgeProps {
  readonly profile: ProfileEntity;
}

/**
 * The entity's icon badge as a color picker trigger: clicking it opens the color swatches, and a
 * chosen color is saved as the user's override for that entity — e.g. next to the title of the
 * entity's configuration page.
 */
export function EntityColorBadge({ profile }: Readonly<EntityColorBadgeProps>) {
  const { preferences, setOverride } = useEntityDisplayPreferences(profile);
  return (
    <ColorPicker value={preferences.color} onChange={(color) => setOverride({ color })}>
      <EntityIconBadge profile={profile} />
    </ColorPicker>
  );
}
