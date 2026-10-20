import { describe, expect, it } from "vitest";
import { makeSearchBarProfiles } from "../../test-fixtures/msw/search-bar-fixtures";
import {
  entityDisplayPreferencesSchema,
  validateEntityDisplayPreferencesMap,
} from "./entity-display-preferences";

describe("entityDisplayPreferencesSchema.searchAttributes", () => {
  it("accepts a list of attribute names", () => {
    expect(entityDisplayPreferencesSchema.parse({ searchAttributes: ["title", "status"] })).toEqual(
      {
        searchAttributes: ["title", "status"],
      },
    );
  });

  it("is optional", () => {
    expect(entityDisplayPreferencesSchema.parse({})).toEqual({});
  });

  it("rejects anything but a list of strings", () => {
    expect(entityDisplayPreferencesSchema.safeParse({ searchAttributes: "title" }).success).toBe(
      false,
    );
    expect(entityDisplayPreferencesSchema.safeParse({ searchAttributes: [1] }).success).toBe(false);
  });

  it("is validated in the backend defaults map", () => {
    expect(
      validateEntityDisplayPreferencesMap({ invoice: { searchAttributes: ["number"] } }).success,
    ).toBe(true);
    expect(validateEntityDisplayPreferencesMap({ invoice: { searchAttributes: 3 } }).success).toBe(
      false,
    );
  });

  it("is left unset by the heuristic defaults, meaning every searchable attribute", () => {
    expect(
      makeSearchBarProfiles().searchBar.getDefaultPreferences().searchAttributes,
    ).toBeUndefined();
  });
});
