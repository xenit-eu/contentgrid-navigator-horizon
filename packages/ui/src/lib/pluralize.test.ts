import { describe, expect, it } from "vitest";
import { pluralize } from "./pluralize";

describe("pluralize", () => {
  it.each([
    { count: 1, word: "item" },
    { count: 0, word: "items" },
    { count: 2, word: "items" },
  ])("uses '$word' for $count", ({ count, word }) => {
    expect(pluralize(count, "item")).toBe(word);
  });
});
