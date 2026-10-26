import { describe, expect, it } from "vitest";
import { type ProfileAttribute, ProfileAttributeType } from "@contentgrid/navigator-data";
import { toAttributeOption } from "./attribute-options";

function makeAttribute(overrides: Partial<ProfileAttribute>): ProfileAttribute {
  return {
    name: "invoice_number",
    title: "Invoice Number",
    description: "The invoice number",
    type: ProfileAttributeType.string,
    isContent: false,
    ...overrides,
  } as ProfileAttribute;
}

describe("toAttributeOption", () => {
  it("maps a regular attribute's fields and type through verbatim", () => {
    const attribute = makeAttribute({ type: ProfileAttributeType.long });

    expect(toAttributeOption(attribute, false)).toEqual({
      name: "invoice_number",
      title: "Invoice Number",
      description: "The invoice number",
      type: "long",
      isSystem: false,
    });
  });

  it("maps a content attribute's type to 'content' instead of its raw wire type", () => {
    const attribute = makeAttribute({ type: ProfileAttributeType.object, isContent: true });

    expect(toAttributeOption(attribute, false).type).toBe("content");
  });

  it("passes isSystem through verbatim", () => {
    const attribute = makeAttribute({});

    expect(toAttributeOption(attribute, true).isSystem).toBe(true);
    expect(toAttributeOption(attribute, false).isSystem).toBe(false);
  });
});
