import { describe, expect, it } from "vitest";
import {
  type EntityItemAttribute,
  EntityItemAttributeContent,
  EntityItemAttributeNested,
  EntityItemAttributePlain,
  EntityItemAttributeUnknown,
} from "@contentgrid/navigator-data";
import { formatAttributeValue } from "./attribute-format";

type ContentLink = ConstructorParameters<typeof EntityItemAttributeContent>[2];

function attr(value: EntityItemAttribute["value"]): EntityItemAttribute {
  return { value };
}

describe("formatAttributeValue", () => {
  it("stringifies a non-null plain value", () => {
    expect(formatAttributeValue(attr(new EntityItemAttributePlain("number", "INV-001")))).toBe(
      "INV-001",
    );
  });

  it("renders a null plain value as an em dash", () => {
    expect(formatAttributeValue(attr(new EntityItemAttributePlain("number", null)))).toBe("—");
  });

  it("renders the filename for a content attribute", () => {
    const metadata = { length: 10, mimetype: "application/pdf", filename: "invoice.pdf" };
    expect(
      formatAttributeValue(
        attr(new EntityItemAttributeContent("file", metadata, { href: "/content" } as ContentLink)),
      ),
    ).toBe("invoice.pdf");
  });

  it("renders an em dash when a content attribute has no filename", () => {
    const metadata = { length: 10, mimetype: "application/pdf", filename: null };
    expect(
      formatAttributeValue(
        attr(new EntityItemAttributeContent("file", metadata, { href: "/content" } as ContentLink)),
      ),
    ).toBe("—");
  });

  it("renders (object) for a nested attribute", () => {
    expect(formatAttributeValue(attr(new EntityItemAttributeNested("address", {})))).toBe(
      "(object)",
    );
  });

  it("renders an em dash for an unknown attribute kind", () => {
    expect(formatAttributeValue(attr(new EntityItemAttributeUnknown("weird")))).toBe("—");
  });
});
