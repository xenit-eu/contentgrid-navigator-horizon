import { describe, expect, it } from "vitest";
import {
  SEARCH_BAR_STATUS_OPTIONS,
  makeSearchBarProfiles,
} from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const { fields } = resolveHalFormsFields(searchTemplate);
const descriptors = buildSearchParamDescriptors(fields, searchTemplate, all);
const byName = new Map(descriptors.map((d) => [d.name, d]));

describe("buildSearchParamDescriptors", () => {
  it("builds one descriptor per resolved field, in field order", () => {
    expect(descriptors.map((d) => d.name)).toEqual(fields.map((f) => f.name));
  });

  it("never produces a descriptor for _sort", () => {
    expect(byName.has("_sort")).toBe(false);
  });

  it.each([
    ["title~prefix", "text", "prefix"],
    ["notes~fts", "text", "full-text"],
    ["reference", "text", "exact"],
    ["status", "allowed-values", "allowed-values"],
    ["quantity", "integer", "exact"],
    ["quantity~gte", "integer", "gte"],
    ["quantity~lte", "integer", "lte"],
    ["amount", "decimal", "exact"],
    ["amount~gte", "decimal", "gte"],
    ["due_date~from", "date", "gte"],
    ["due_date~until", "date", "lte"],
    ["received_at~after", "datetime", "gt"],
    ["received_at~before", "datetime", "lt"],
    ["urgent", "boolean", "exact"],
    ["customer.name~prefix", "text", "prefix"],
  ] as const)("%s → valueKind %s, mode %s", (name, valueKind, mode) => {
    expect(byName.get(name)).toMatchObject({ valueKind, mode });
  });

  it("drops the exact title parameter because a prefix sibling exists (hal-forms redundancy)", () => {
    expect(byName.has("title")).toBe(false);
  });

  it("carries inline options for allowed values", () => {
    expect(byName.get("status")?.options?.map((o) => o.value)).toEqual([
      ...SEARCH_BAR_STATUS_OPTIONS,
    ]);
  });

  it("reads audit roles from the profile constraints", () => {
    expect(byName.get("created_at~after")?.auditRole).toBe("created");
    expect(byName.get("modified_at~before")?.auditRole).toBe("modified");
    expect(byName.get("received_at~after")?.auditRole).toBeUndefined();
  });

  it("groups an attribute's parameters under its groupKey", () => {
    expect(byName.get("quantity~gte")?.groupKey).toBe("quantity");
    expect(byName.get("customer.name~prefix")?.groupKey).toBe("customer.name");
  });

  it("describes relation parameters with the relation and the target attribute", () => {
    expect(byName.get("customer.name~prefix")).toMatchObject({
      relation: { name: "customer", title: "Customer" },
      attributeLabel: "Name",
    });
    expect(byName.get("title~prefix")?.relation).toBeUndefined();
    expect(byName.get("title~prefix")?.attributeLabel).toBe("Title");
  });

  it("falls back to the raw attribute name when the relation target is not loaded", () => {
    const withoutTargets = buildSearchParamDescriptors(fields, searchTemplate, [searchBar]);
    const customerName = withoutTargets.find((d) => d.name === "customer.name~prefix");
    expect(customerName).toMatchObject({ valueKind: "text", attributeLabel: "name" });
  });
});
