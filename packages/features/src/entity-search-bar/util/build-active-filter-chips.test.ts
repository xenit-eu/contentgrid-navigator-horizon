import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { buildActiveFilterChips } from "./build-active-filter-chips";
import { buildSearchParamDescriptors } from "./build-search-param-descriptors";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const descriptors = buildSearchParamDescriptors(
  resolveHalFormsFields(searchTemplate).fields,
  searchTemplate,
  all,
);
const chips = (filters: Record<string, string>) =>
  buildActiveFilterChips(descriptors, filters, { locale: "en-GB", timeZone: "UTC" });

describe("buildActiveFilterChips", () => {
  it("builds one chip per non-range parameter with its mode", () => {
    expect(
      chips({
        "title~prefix": "Al",
        "notes~fts": "advance",
        reference: "REF-1",
        status: "draft",
      }).map((c) => [c.id, c.field, c.mode, c.value]),
    ).toEqual([
      ["title~prefix", "Title", "starts with", "Al"],
      ["notes~fts", "Notes", "full text", "advance"],
      ["reference", "Reference", "is", "REF-1"],
      ["status", "Status", "is", "draft"],
    ]);
  });

  it("merges both bounds of a range into one chip that removes both", () => {
    const [chip] = chips({
      "received_at~after": "2026-10-01T00:00:00.000Z",
      "received_at~before": "2026-10-07T00:00:00.000Z",
    });
    expect(chip).toMatchObject({
      id: "range:received_at",
      field: "Received at",
      mode: "between",
      value: "1 Oct 2026, 00:00 – 7 Oct 2026, 00:00",
      paramNames: ["received_at~after", "received_at~before"],
    });
  });

  it("labels a single bound by its direction", () => {
    expect(chips({ "quantity~gte": "3" })[0]).toMatchObject({
      mode: "≥",
      value: "3",
      paramNames: ["quantity~gte"],
    });
    expect(chips({ "due_date~until": "2026-12-31" })[0]).toMatchObject({
      mode: "until",
      value: "31 Dec 2026",
    });
    expect(chips({ "received_at~after": "2026-10-01T00:00:00.000Z" })[0]?.mode).toBe("after");
  });

  it("keeps an exact number next to its range as separate chips", () => {
    expect(chips({ quantity: "4", "quantity~lte": "10" }).map((c) => [c.id, c.mode])).toEqual([
      ["quantity", "is"],
      ["range:quantity", "≤"],
    ]);
  });

  it("marks boolean values for their icon", () => {
    expect(chips({ urgent: "true" })[0]).toMatchObject({ value: "True", booleanValue: true });
    expect(chips({ urgent: "false" })[0]).toMatchObject({ value: "False", booleanValue: false });
  });

  it("names relation chips after the relation and attribute", () => {
    expect(chips({ "customer.name~prefix": "Ac" })[0]?.field).toBe("Customer · Name");
  });

  it("ignores empty values", () => {
    expect(chips({ "title~prefix": "", urgent: "" })).toEqual([]);
  });

  it("still shows a key the search form does not know, last, with its raw value", () => {
    expect(
      chips({ legacy: "x", "title~prefix": "Al" }).map((c) => [
        c.id,
        c.isUnresolved,
        c.field,
        c.value,
      ]),
    ).toEqual([
      ["title~prefix", false, "Title", "Al"],
      ["legacy", true, "legacy", "x"],
    ]);
  });

  it("follows the form's parameter order, not the order of the filters", () => {
    expect(chips({ urgent: "true", "title~prefix": "Al" }).map((c) => c.id)).toEqual([
      "title~prefix",
      "urgent",
    ]);
  });
});
