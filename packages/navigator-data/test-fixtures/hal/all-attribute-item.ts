import { HalObject } from "@contentgrid/hal";
import { EntityItem } from "../../src/accessors/entity-item";
import type { EntityItemShape } from "../../src/shapes";
import allAttributeProfile from "../halforms/all-attribute.json";
import allAttributeItemBody from "../halforms/items/all-attribute-item.json";
import { makeProfileEntity } from "./profile-entity";

export const ALL_ATTRIBUTE_ITEM_URL = allAttributeItemBody._links.self.href;

/**
 * The `all-attribute` item fixture body, with `values` replacing its attribute values (e.g. `null`
 * for an attribute without a value).
 */
export function allAttributeItemBodyWith(values: Record<string, unknown> = {}): EntityItemShape {
  return { ...allAttributeItemBody, ...values } as unknown as EntityItemShape;
}

/** The `all-attribute` item fixture as an `EntityItem`, with its profile. */
export function makeAllAttributeItem(
  values: Record<string, unknown> = {},
  etag: string | null = null,
): EntityItem {
  const profileEntity = makeProfileEntity(
    allAttributeProfile,
    "https://api.example.contentgrid.com/profile/all-attributes",
    "all-attribute",
  );
  return new EntityItem(new HalObject(allAttributeItemBodyWith(values)), profileEntity, etag);
}
