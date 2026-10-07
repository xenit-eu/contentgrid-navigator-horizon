import { describe, expect, it } from "vitest";
import { filterOptionsByPrefix } from "./filter-options";

const options = [
  { value: "draft", label: "Draft" },
  { value: "approved_by_manager", label: "Approved by manager" },
  { value: "rejected", label: "Rejected" },
  { value: "eclair", label: "Éclair" },
  { value: "x-1", label: "Special" },
];

const labels = (list: readonly { label: string }[]) => list.map((o) => o.label);

describe("filterOptionsByPrefix", () => {
  it("matches a label prefix", () => {
    expect(labels(filterOptionsByPrefix(options, "dr"))).toEqual(["Draft"]);
  });

  it("matches the start of a word inside the label", () => {
    expect(labels(filterOptionsByPrefix(options, "man"))).toEqual(["Approved by manager"]);
  });

  it("ignores case", () => {
    expect(labels(filterOptionsByPrefix(options, "REJ"))).toEqual(["Rejected"]);
  });

  it("ignores accents on both sides", () => {
    expect(labels(filterOptionsByPrefix(options, "ecl"))).toEqual(["Éclair"]);
    expect(labels(filterOptionsByPrefix(options, "écl"))).toEqual(["Éclair"]);
  });

  it("falls back to the value when the label does not match", () => {
    expect(labels(filterOptionsByPrefix(options, "x-"))).toEqual(["Special"]);
  });

  it("ranks label-prefix matches before word-start matches", () => {
    const list = [
      { value: "a", label: "Big apple" },
      { value: "b", label: "Apple pie" },
    ];
    expect(labels(filterOptionsByPrefix(list, "app"))).toEqual(["Apple pie", "Big apple"]);
  });

  it("does not match in the middle of a word", () => {
    expect(filterOptionsByPrefix(options, "aft")).toEqual([]);
  });

  it("returns every option for an empty or blank query, up to the limit", () => {
    expect(filterOptionsByPrefix(options, "")).toHaveLength(5);
    expect(filterOptionsByPrefix(options, "   ", 2)).toHaveLength(2);
  });

  it("truncates matches to the limit", () => {
    expect(labels(filterOptionsByPrefix(options, "r", 1))).toEqual(["Rejected"]);
  });
});
