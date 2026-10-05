import { describe, expect, it } from "vitest";
import { makeAllAttributeItem } from "../../../test-fixtures/hal/all-attribute-item";

describe("UpdateHalFormTemplate", () => {
  it("is null when the item has no default template", () => {
    const item = makeAllAttributeItem({ _templates: {} });

    expect(item.updateTemplate).toBeNull();
    expect(item.updateFormValues).toBeNull();
  });
});
