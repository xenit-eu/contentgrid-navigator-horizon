import type { ReactNode } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { resolveEntityCardIcon, useEntityDisplayPreferences } from "../../../preferences";
import { AttributeValueRenderer } from "../../attributes/renderers/attribute-value-renderer";

/** Hard limit on the characters of the title and the subtitle (plus an ellipsis). */
const MAX_CHAR_LENGTH = 120;

/**
 * The heading of an entity item as the entity's display preferences describe it: its icon and
 * color, a title from the preferred name attribute (the item id when none is configured or the
 * item has no value for it), and a subtitle from the preferred subtitle attribute (`undefined`
 * when none is configured or the item has no value for it).
 */
export function useEntityItemHeading(item: EntityItem) {
  const { preferences, nameAttribute, subtitleAttribute } = useEntityDisplayPreferences(
    item.profileEntity,
  );
  const Icon = resolveEntityCardIcon(preferences.icon);

  const nameAttr = nameAttribute ? item.findAttribute(nameAttribute.name) : undefined;
  const title: ReactNode = nameAttr ? (
    <AttributeValueRenderer
      attr={nameAttr}
      maxCharLength={MAX_CHAR_LENGTH}
      variant="item-reference"
    />
  ) : (
    item.id
  );

  const subtitleAttr = subtitleAttribute ? item.findAttribute(subtitleAttribute.name) : undefined;
  const subtitle: ReactNode | undefined = subtitleAttr ? (
    <AttributeValueRenderer
      attr={subtitleAttr}
      maxCharLength={MAX_CHAR_LENGTH}
      variant="item-reference"
    />
  ) : undefined;

  return { preferences, Icon, title, subtitle };
}
