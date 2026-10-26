import { type ProfileAttribute } from "@contentgrid/navigator-data";
import { type ProfileAttributeOption } from "@contentgrid/ui";

/** Maps a `ProfileAttribute` to the `ProfileAttributeOption` shape the attribute-selector patterns render. */
export function toAttributeOption(
  attribute: ProfileAttribute,
  isSystem: boolean,
): ProfileAttributeOption {
  return {
    name: attribute.name,
    title: attribute.title,
    description: attribute.description,
    type: attribute.isContent
      ? "content"
      : (attribute.type as unknown as ProfileAttributeOption["type"]),
    isSystem,
  };
}
