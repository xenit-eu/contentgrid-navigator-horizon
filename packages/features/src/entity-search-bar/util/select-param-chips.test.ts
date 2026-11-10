import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import { isSelectableParam, selectParamChips } from "./select-param-chips";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);
const ALL = { kind: "all" } as const;
const names = (list: readonly { name: string }[]) => list.map((d) => d.name);

const TEXT_PARAMS = [
  "title~prefix",
  "notes~fts",
  "reference",
  "status",
  "customer.name~prefix",
  "owner.email~prefix",
];

describe("isSelectableParam", () => {
  it("accepts text, allowed values and exact numbers; rejects ranges, dates and booleans", () => {
    expect(names(descriptors.filter(isSelectableParam))).toEqual([
      "title~prefix",
      "notes~fts",
      "reference",
      "status",
      "quantity",
      "amount",
      "customer.name~prefix",
      "owner.email~prefix",
    ]);
  });
});

describe("selectParamChips", () => {
  it("offers only text parameters for text input", () => {
    expect(names(selectParamChips(descriptors, "text", ALL))).toEqual(TEXT_PARAMS);
  });

  it("lists integer and decimal parameters first for a whole number, text after", () => {
    expect(names(selectParamChips(descriptors, "integer", ALL))).toEqual([
      "quantity",
      "amount",
      ...TEXT_PARAMS,
    ]);
  });

  it("drops integer parameters for a decimal number", () => {
    expect(names(selectParamChips(descriptors, "decimal", ALL))).toEqual([
      "amount",
      ...TEXT_PARAMS,
    ]);
  });

  it("drops relation parameters in 'All except relations' mode", () => {
    expect(names(selectParamChips(descriptors, "text", { kind: "all-direct" }))).toEqual([
      "title~prefix",
      "notes~fts",
      "reference",
      "status",
    ]);
  });

  it("offers nothing for empty input or when a parameter is selected", () => {
    expect(selectParamChips(descriptors, "empty", ALL)).toEqual([]);
    expect(selectParamChips(descriptors, "text", { kind: "param", name: "notes~fts" })).toEqual([]);
  });
});
