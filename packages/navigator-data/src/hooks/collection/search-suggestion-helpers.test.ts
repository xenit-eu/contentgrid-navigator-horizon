import { describe, expect, it } from "vitest";
import { HalSlice } from "@contentgrid/hal";
import {
  SEARCH_BAR_COLLECTION_URL,
  makeSearchBarProfiles,
  searchBarItems,
} from "../../../test-fixtures/msw/search-bar-fixtures";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type { EntityItemShape } from "../../shapes";
import {
  countAttributeValues,
  extractAttributeSuggestions,
  resolveRelationSearchTarget,
} from "./search-suggestion-helpers";

const { searchBar, customer, all } = makeSearchBarProfiles();
const template = searchBar.searchTemplate!;

function collectionOf(items: Record<string, unknown>[]) {
  const slice = new HalSlice<EntityItemShape>({
    _embedded: {
      item: items.map((data, i) => ({
        ...data,
        _links: { self: { href: `${SEARCH_BAR_COLLECTION_URL}/${i}` } },
      })),
    },
    _links: { self: { href: SEARCH_BAR_COLLECTION_URL } },
  } as unknown as ConstructorParameters<typeof HalSlice<EntityItemShape>>[0]);
  return new EntityItemCollection(slice, searchBar);
}

describe("resolveRelationSearchTarget", () => {
  it("resolves a relation parameter to the target profile and its local parameter", () => {
    const property = template.getSearchPropertyByName("customer.name~prefix")!;
    const target = resolveRelationSearchTarget(property, all);

    expect(target?.targetProfile).toBe(customer);
    expect(target?.targetSearchProperty.property.name).toBe("name~prefix");
    expect(target?.targetAttribute?.name).toBe("name");
  });

  it("returns undefined for a direct parameter", () => {
    const property = template.getSearchPropertyByName("title~prefix")!;
    expect(resolveRelationSearchTarget(property, all)).toBeUndefined();
  });

  it("returns undefined when the target profile is not loaded", () => {
    const property = template.getSearchPropertyByName("customer.name~prefix")!;
    expect(resolveRelationSearchTarget(property, [searchBar])).toBeUndefined();
  });
});

describe("extractAttributeSuggestions / countAttributeValues", () => {
  const collection = collectionOf([
    { title: "Alpha" },
    { title: "" },
    { title: "Beta" },
    { title: "Alpha" },
    { quantity: 3 },
    { title: "Gamma" },
  ]);

  it("returns distinct, non-empty values in response order", () => {
    expect(extractAttributeSuggestions(collection, "title", 10)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("caps the result at the limit", () => {
    expect(extractAttributeSuggestions(collection, "title", 2)).toEqual(["Alpha", "Beta"]);
  });

  it("counts duplicate occurrences", () => {
    expect(countAttributeValues(collection, "title")).toEqual([
      { value: "Alpha", count: 2 },
      { value: "Beta", count: 1 },
      { value: "Gamma", count: 1 },
    ]);
  });

  it("ignores non-string values and missing inputs", () => {
    expect(extractAttributeSuggestions(collection, "quantity", 10)).toEqual([]);
    expect(extractAttributeSuggestions(undefined, "title", 10)).toEqual([]);
    expect(extractAttributeSuggestions(collection, undefined, 10)).toEqual([]);
  });

  it("works on the shared fixture items", () => {
    expect(extractAttributeSuggestions(collectionOf(searchBarItems), "title", 10)).toEqual([
      "Alpha invoice",
      "Alpha order",
      "Beta contract",
    ]);
  });
});
