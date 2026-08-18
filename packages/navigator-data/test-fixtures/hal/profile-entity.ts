import { HalObject, type Link } from "@contentgrid/hal";
import ProfileEntity from "../../src/accessors/entity-profile";
import type { ProfileEntityShape } from "../../src/shapes";

/**
 * Build a ProfileEntity directly from raw HAL JSON, bypassing any HTTP/hook layer — for
 * consumers that need white-box accessor-level tests (e.g. testing a HAL-FORMS bridge
 * function against a hand-built or dumped profile fixture) rather than an MSW-mocked
 * integration test through the hooks.
 */
export function makeProfileEntity(
  json: Record<string, unknown>,
  linkHref = "https://example.com/profile/things",
  linkName = "thing",
): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  const link = { href: linkHref, name: linkName } as unknown as Link;
  return new ProfileEntity(link, hal as HalObject<ProfileEntityShape>);
}
