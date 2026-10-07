import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";
import {
  ALL_DIRECT_OPTION,
  ALL_OPTION,
  buildSelectorGroups,
  selectorMode,
  selectorValue,
} from "./build-selector-groups";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);

describe("buildSelectorGroups", () => {
  const groups = buildSelectorGroups(descriptors, "Search bar");

  it("starts with an unlabelled group holding 'All' and 'All except relations'", () => {
    expect(groups[0]).toEqual({
      id: "modes",
      options: [
        { value: ALL_OPTION, label: "All" },
        { value: ALL_DIRECT_OPTION, label: "All except relations" },
      ],
    });
  });

  it("then lists the entity's own text, allowed-value and exact number parameters", () => {
    expect(groups[1]?.label).toBe("Search bar");
    expect(groups[1]?.options.map((o) => [o.value, o.label])).toEqual([
      ["title~prefix", "Title"],
      ["notes~fts", "Notes"],
      ["reference", "Reference"],
      ["status", "Status"],
      ["quantity", "Quantity"],
      ["amount", "Amount"],
    ]);
  });

  it("then one group per relation, headed by the relation title", () => {
    expect(groups.slice(2).map((g) => [g.id, g.label, g.options.map((o) => o.value)])).toEqual([
      ["customer", "Customer", ["customer.name~prefix"]],
      ["owner", "Owner", ["owner.email~prefix"]],
    ]);
  });

  it("never offers date, boolean or range parameters", () => {
    const values = groups.flatMap((g) => g.options.map((o) => o.value));
    for (const excluded of ["due_date~from", "received_at~after", "urgent", "quantity~gte"]) {
      expect(values).not.toContain(excluded);
    }
  });

  it("omits 'All except relations' when there are no relation parameters", () => {
    const direct = descriptors.filter((d) => !d.relation);
    expect(buildSelectorGroups(direct, "Search bar")[0]?.options.map((o) => o.value)).toEqual([
      ALL_OPTION,
    ]);
  });
});

describe("selectorValue / selectorMode", () => {
  it("round-trips every mode", () => {
    for (const mode of [
      { kind: "all" },
      { kind: "all-direct" },
      { kind: "param", name: "notes~fts" },
    ] as const) {
      expect(selectorMode(selectorValue(mode))).toEqual(mode);
    }
  });
});
