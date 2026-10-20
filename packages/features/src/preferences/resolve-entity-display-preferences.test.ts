import { describe, expect, it } from "vitest";
import { createRelationDemoAccessors } from "@contentgrid/navigator-data/test-fixtures/hal/relation-demo-accessors";
import { resolveEntityDisplayPreferences } from "./resolve-entity-display-preferences";

const demo = createRelationDemoAccessors();

describe("resolveEntityDisplayPreferences", () => {
  it("falls back to the profile heuristic", () => {
    const { preferences, nameAttribute } = resolveEntityDisplayPreferences(
      demo.profile("order"),
      undefined,
      undefined,
    );
    expect(preferences.icon).toBe("Database");
    expect(preferences.color).toBeUndefined();
    expect(nameAttribute?.name).toBe("number");
  });

  it("layers user override over backend default over heuristic", () => {
    const { preferences, nameAttribute } = resolveEntityDisplayPreferences(
      demo.profile("order"),
      { color: "red" },
      { color: "blue", icon: "Package", nameAttribute: "status" },
    );
    expect(preferences.color).toBe("red");
    expect(preferences.icon).toBe("Package");
    expect(nameAttribute?.name).toBe("status");
  });

  it("returns no attributes for an unresolved profile", () => {
    const resolved = resolveEntityDisplayPreferences(undefined, { color: "red" }, undefined);
    expect(resolved.preferences.color).toBe("red");
    expect(resolved.nameAttribute).toBeUndefined();
  });
});
