import { describe, expect, it } from "vitest";
import { itemNoun } from "./item-noun";

describe("itemNoun", () => {
  it.each([
    { total: { count: 1, isEstimated: false }, noun: "item" },
    { total: { count: 0, isEstimated: false }, noun: "items" },
    { total: { count: 2, isEstimated: false }, noun: "items" },
    { total: { count: 1, isEstimated: true }, noun: "item" },
  ])("uses '$noun' for $total.count (estimated: $total.isEstimated)", ({ total, noun }) => {
    expect(itemNoun(total)).toBe(noun);
  });
});
