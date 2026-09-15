import { HalObject, type Link } from "@contentgrid/hal";
import { EntityItem } from "../../src/accessors/entity-item";
import ProfileEntity from "../../src/accessors/entity-profile";
import type { EntityItemShape, ProfileEntityShape } from "../../src/shapes";

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

/**
 * Build an EntityItem directly from raw HAL JSON and a `ProfileEntity`, bypassing any
 * HTTP/hook layer — mirrors `makeProfileEntity` above. For consumers (e.g. component
 * tests in `packages/features`) that need a real `EntityItem` / relation accessor object
 * without fetching one through MSW; only the mutation/relation-read requests those
 * accessors go on to make still need MSW handlers.
 */
export function makeEntityItem(
  json: Record<string, unknown>,
  profileEntity: ProfileEntity,
  etag: string | null = null,
): EntityItem {
  const hal = new HalObject(json as unknown as EntityItemShape);
  return new EntityItem(hal as HalObject<EntityItemShape>, profileEntity, etag);
}
