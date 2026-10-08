import { describe, expect, it } from "vitest";
import { makeAllAttributeItem } from "../../../test-fixtures/hal/all-attribute-item";

describe("UpdateHalFormTemplate", () => {
  it("is null when the item has no default template", () => {
    const item = makeAllAttributeItem({ _templates: {} });

    expect(item.updateTemplate).toBeNull();
    expect(item.updateFormValues).toBeNull();
  });

  it("links the default template's properties to their profile attributes", () => {
    const properties = makeAllAttributeItem().updateTemplate!.userDefinedProperties;
    const byName = new Map(properties.map((p) => [p.property.name, p]));

    expect([...byName.keys()]).toEqual([
      "text",
      "long",
      "double",
      "boolean",
      "datetime",
      "content.filename",
      "content.mimetype",
      "constrained_text",
    ]);
    expect(byName.get("text")?.profileAttribute?.name).toBe("text");
    // A content attribute is edited through plain text properties, not a file upload.
    for (const name of ["content.filename", "content.mimetype"]) {
      expect(byName.get(name)).toMatchObject({ isContent: false, profileAttribute: undefined });
    }
    expect(byName.get("constrained_text")?.profileAttribute?.name).toBe("constrained_text");
    expect(byName.get("constrained_text")?.allowedValues).toEqual([
      "Constraint A",
      "Constraint B",
      "Constraint C",
    ]);
  });
});
