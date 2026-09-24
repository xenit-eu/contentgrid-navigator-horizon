import { describe, expect, it } from "vitest";
import type { EnumOption } from "@contentgrid/ui";
import { filterEnumOptions } from "./enum-quick-filter";

const options: readonly EnumOption[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

describe("filterEnumOptions", () => {
  it("returns every option unchanged for an empty query", () => {
    expect(filterEnumOptions(options, "")).toEqual(options);
  });

  it("returns every option unchanged for a whitespace-only query", () => {
    expect(filterEnumOptions(options, "   ")).toEqual(options);
  });

  it("matches by label, case-insensitively", () => {
    expect(filterEnumOptions(options, "draf")).toEqual([{ value: "draft", label: "Draft" }]);
  });

  it("matches by value when the label doesn't match", () => {
    const withMismatchedLabel: readonly EnumOption[] = [{ value: "arch_2024", label: "Old" }];
    expect(filterEnumOptions(withMismatchedLabel, "arch")).toEqual(withMismatchedLabel);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterEnumOptions(options, "zzz")).toEqual([]);
  });

  it("matches a substring anywhere, not just a prefix", () => {
    expect(filterEnumOptions(options, "chiv")).toEqual([{ value: "archived", label: "Archived" }]);
  });
});
