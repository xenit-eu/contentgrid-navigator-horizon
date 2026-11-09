import { describe, expect, it, vi } from "vitest";
import {
  type EntityItem,
  type EntityItemAttribute,
  EntityItemAttributeContent,
  EntityItemAttributeUnknown,
} from "@contentgrid/navigator-data";
import { getContentAttributeMetadata } from "./content-attribute-metadata";

/**
 * Duck-typed `EntityItem` built from real, exported navigator-data value types
 * (`EntityItemAttributeContent`, `AttributeKind`), following the pattern established in
 * `select-default-content-attribute.test.ts` — `@contentgrid/navigator-data`'s `exports` map
 * doesn't publish its internal test-utils, and `findAttribute` is a real method on the real
 * class, so a full `EntityItem` instance (not a plain object) is needed here.
 */
function makeEntityItem(attributes: readonly EntityItemAttribute[]): EntityItem {
  return {
    attributes,
    findAttribute(name: string) {
      return attributes.find((attr) => attr.value.name === name);
    },
  } as unknown as EntityItem;
}

function makeContentAttribute(name: string, hasFile: boolean): EntityItemAttribute {
  return {
    value: new EntityItemAttributeContent(
      name,
      hasFile ? { filename: `${name}.pdf`, length: 10, mimetype: "application/pdf" } : null,
      { href: `https://api.example.com/items/1/${name}` } as never,
    ),
  };
}

describe("getContentAttributeMetadata", () => {
  it("returns the metadata for a content attribute that holds a file", () => {
    const entityItem = makeEntityItem([makeContentAttribute("document", true)]);

    expect(getContentAttributeMetadata(entityItem, "document")).toEqual({
      filename: "document.pdf",
      length: 10,
      mimetype: "application/pdf",
    });
  });

  it("returns null for a content attribute that holds no file", () => {
    const entityItem = makeEntityItem([makeContentAttribute("document", false)]);

    expect(getContentAttributeMetadata(entityItem, "document")).toBeNull();
  });

  it("returns undefined when the item has no attribute by that name at all", () => {
    const entityItem = makeEntityItem([makeContentAttribute("document", true)]);

    expect(getContentAttributeMetadata(entityItem, "missing")).toBeUndefined();
  });

  it("returns undefined when the named attribute exists but isn't a content attribute", () => {
    const entityItem = makeEntityItem([
      { value: new EntityItemAttributeUnknown("not-content") } as EntityItemAttribute,
    ]);

    expect(getContentAttributeMetadata(entityItem, "not-content")).toBeUndefined();
  });

  it("uses EntityItem.findAttribute rather than hand-rolling the lookup", () => {
    const entityItem = makeEntityItem([makeContentAttribute("document", true)]);
    const spy = vi.spyOn(entityItem, "findAttribute");

    getContentAttributeMetadata(entityItem, "document");

    expect(spy).toHaveBeenCalledWith("document");
  });
});
