import { HalObject, type Link } from "@contentgrid/hal";
import type { ProfileEntityShape } from "../../shapes";
import ProfileEntity from "../entity-profile";

/** Build a ProfileEntity from raw HAL JSON for extended-forms accessor tests. */
export function makeProfileEntity(
  json: Record<string, unknown>,
  linkHref = "https://example.com/profile/things",
  linkName = "thing",
): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  const link = { href: linkHref, name: linkName } as unknown as Link;
  return new ProfileEntity(link, hal as HalObject<ProfileEntityShape>);
}
