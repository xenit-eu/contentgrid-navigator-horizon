import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildQuickFilters } from "./build-quick-filters";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);

function quickFilters(filters: Record<string, string> = {}) {
  return buildQuickFilters(descriptors, filters);
}

describe("buildQuickFilters", () => {
  it("builds one quick filter per direct attribute, in profile order, audit dates last", () => {
    expect(quickFilters().map((q) => [q.groupKey, q.kind])).toEqual([
      ["status", "allowed-values"],
      ["quantity", "number"],
      ["amount", "number"],
      ["due_date", "date"],
      ["received_at", "date"],
      ["urgent", "boolean"],
      ["created_at", "date"],
      ["modified_at", "date"],
    ]);
  });

  it("never builds a quick filter for text or relation parameters", () => {
    const keys = quickFilters().map((q) => q.groupKey);
    expect(keys).not.toContain("title");
    expect(keys).not.toContain("notes");
    expect(keys).not.toContain("customer.name");
    expect(keys).not.toContain("owner.email");
  });

  it("describes date bounds and their precision", () => {
    const [dueDate, receivedAt] = quickFilters().filter((q) => q.kind === "date");
    expect(dueDate).toMatchObject({
      includesTime: false,
      lower: "due_date~from",
      lowerInclusive: true,
      upper: "due_date~until",
      upperInclusive: true,
    });
    expect(receivedAt).toMatchObject({
      includesTime: true,
      lower: "received_at~after",
      lowerInclusive: false,
      upper: "received_at~before",
      upperInclusive: false,
    });
  });

  it("marks audit date quick filters with their role", () => {
    const audit = quickFilters().filter((q) => q.kind === "date" && q.auditRole);
    expect(audit.map((q) => (q.kind === "date" ? q.auditRole : undefined))).toEqual([
      "created",
      "modified",
    ]);
  });

  it("types number quick filters as integer or decimal and lists all their params", () => {
    const numbers = quickFilters().filter((q) => q.kind === "number");
    expect(
      numbers.map((q) => [q.groupKey, q.kind === "number" && q.valueKind, q.paramNames]),
    ).toEqual([
      ["quantity", "integer", ["quantity", "quantity~gte", "quantity~lte"]],
      ["amount", "decimal", ["amount", "amount~gte", "amount~lte"]],
    ]);
  });

  it("is active when any of its params has a value, whatever set it", () => {
    const filters = { "received_at~before": "2026-10-01T00:00:00.000Z", "quantity~gte": "3" };
    const byKey = new Map(quickFilters(filters).map((q) => [q.groupKey, q]));
    expect(byKey.get("received_at")).toMatchObject({ isActive: true, tone: "active" });
    expect(byKey.get("quantity")).toMatchObject({ isActive: true, tone: "active" });
    expect(byKey.get("due_date")).toMatchObject({ isActive: false, tone: "idle" });
  });

  it("gives booleans a positive or negative tone instead of active", () => {
    const urgent = (filters: Record<string, string>) =>
      quickFilters(filters).find((q) => q.groupKey === "urgent");
    expect(urgent({})).toMatchObject({ tone: "idle", value: undefined, isActive: false });
    expect(urgent({ urgent: "true" })).toMatchObject({ tone: "positive", value: true });
    expect(urgent({ urgent: "false" })).toMatchObject({ tone: "negative", value: false });
  });

  it("carries the allowed values and the current one", () => {
    const status = quickFilters({ status: "approved" }).find((q) => q.groupKey === "status");
    expect(status).toMatchObject({ kind: "allowed-values", value: "approved", tone: "active" });
    expect(status?.kind === "allowed-values" && status.options.map((o) => o.value)).toEqual([
      "draft",
      "approved",
      "rejected",
    ]);
  });
});
