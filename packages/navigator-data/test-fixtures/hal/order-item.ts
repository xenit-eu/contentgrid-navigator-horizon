import { HalObject } from "@contentgrid/hal";
import { EntityItem } from "../../src/accessors/entity-item";
import type { EntityItemShape } from "../../src/shapes";
import orderItemBody from "../halforms/items/order-item.json";
import orderProfile from "../halforms/order.json";
import { makeProfileEntity } from "./profile-entity";

export const ORDER_ITEM_URL = orderItemBody._links.self.href;

/** The `order` item fixture body (two content attributes, `document` and `receipt`). */
export function orderItemBodyWith(values: Record<string, unknown> = {}): EntityItemShape {
  return { ...orderItemBody, ...values } as unknown as EntityItemShape;
}

/** The `order` item fixture as an `EntityItem`, with its profile. */
export function makeOrderItem(
  values: Record<string, unknown> = {},
  etag: string | null = null,
): EntityItem {
  const profileEntity = makeProfileEntity(
    orderProfile,
    "https://api.example.contentgrid.com/profile/orders",
    "order",
  );
  return new EntityItem(new HalObject(orderItemBodyWith(values)), profileEntity, etag);
}
