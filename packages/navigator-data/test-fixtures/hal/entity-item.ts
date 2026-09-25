import { HalObject } from "@contentgrid/hal";
import { EntityItem } from "../../src/accessors/entity-item";
import type ProfileEntity from "../../src/accessors/entity-profile";
import type { EntityItemShape } from "../../src/shapes";

/**
 * Build an EntityItem directly from raw HAL JSON, bypassing any HTTP/hook layer — the
 * entity-item counterpart of `makeProfileEntity`, for consumers that can't import
 * `@contentgrid/hal` themselves.
 */
export function makeEntityItem(
  json: Record<string, unknown>,
  profileEntity: ProfileEntity,
  etag: string | null = null,
): EntityItem {
  return new EntityItem(new HalObject(json as unknown as EntityItemShape), profileEntity, etag);
}
