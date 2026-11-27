import type { CountLike } from "./format-count";

/** The noun after a formatted count: "item" for one ("1 item", "about 1 item"), "items" otherwise. */
export function itemNoun(total: CountLike): "item" | "items" {
  return total.count === 1 ? "item" : "items";
}
