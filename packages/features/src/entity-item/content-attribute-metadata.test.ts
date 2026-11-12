import { describe, expect, it } from "vitest";
import {
  type EntityItem,
  type EntityItemAttribute,
  EntityItemAttributeContent,
  EntityItemAttributeUnknown,
} from "@contentgrid/navigator-data";
import { getContentAttributeMetadata } from "./content-attribute-metadata";

const metadata = { filename: "receipt.pdf", length: 10, mimetype: "application/pdf" };

function makeEntityItem(attribute: EntityItemAttribute | undefined): EntityItem {
  return { findAttribute: () => attribute } as unknown as EntityItem;
}

function contentAttribute(fileMetadata: typeof metadata | null): EntityItemAttribute {
  return {
    value: new EntityItemAttributeContent("receipt", fileMetadata, {
      href: "https://api.example.com/invoices/1/receipt",
    } as never),
  };
}

describe("getContentAttributeMetadata", () => {
  it("returns the stored file's metadata", () => {
    const entityItem = makeEntityItem(contentAttribute(metadata));

    expect(getContentAttributeMetadata(entityItem, "receipt")).toEqual(metadata);
  });

  it("returns null when no file is stored", () => {
    const entityItem = makeEntityItem(contentAttribute(null));

    expect(getContentAttributeMetadata(entityItem, "receipt")).toBeNull();
  });

  it("returns undefined when the item has no attribute by that name", () => {
    const entityItem = makeEntityItem(undefined);

    expect(getContentAttributeMetadata(entityItem, "missing")).toBeUndefined();
  });

  it("returns undefined for an attribute that is not a content attribute", () => {
    const entityItem = makeEntityItem({ value: new EntityItemAttributeUnknown("total") });

    expect(getContentAttributeMetadata(entityItem, "total")).toBeUndefined();
  });
});
