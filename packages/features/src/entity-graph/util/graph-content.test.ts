import { describe, expect, it } from "vitest";
import {
  type EntityItem,
  EntityItemAttributeContent,
  EntityItemAttributePlain,
} from "@contentgrid/navigator-data";
import { contentFileType, contentFilesOf } from "./graph-content";

const link = { href: "https://api.example/invoices/1/document" } as never;

function itemWith(values: Record<string, unknown>): EntityItem {
  const profileAttributes = [
    { name: "number", title: "Number", isContent: false },
    { name: "document", title: "Document", isContent: true },
    { name: "scan", title: "Scan", isContent: true },
    { name: "logo", title: "Logo", isContent: true },
  ];
  return {
    profileEntity: { userDefinedAttributes: profileAttributes },
    findAttribute: (name: string) =>
      name in values ? { value: values[name], profileAttribute: undefined } : undefined,
  } as unknown as EntityItem;
}

describe("contentFilesOf", () => {
  it("lists only the content attributes that hold a file, in profile order", () => {
    const item = itemWith({
      number: new EntityItemAttributePlain("number", "INV-1"),
      document: new EntityItemAttributeContent(
        "document",
        { length: 10, mimetype: "application/pdf", filename: "invoice.pdf" },
        link,
      ),
      scan: new EntityItemAttributeContent("scan", null, link),
      logo: new EntityItemAttributeContent(
        "logo",
        { length: 3, mimetype: "image/png", filename: null },
        link,
      ),
    });

    expect(contentFilesOf(item)).toEqual([
      {
        attributeName: "document",
        attributeTitle: "Document",
        filename: "invoice.pdf",
        mimetype: "application/pdf",
      },
      { attributeName: "logo", attributeTitle: "Logo", filename: null, mimetype: "image/png" },
    ]);
  });

  it("returns nothing for an item without files", () => {
    expect(contentFilesOf(itemWith({}))).toEqual([]);
  });
});

describe("contentFileType", () => {
  it("maps PDFs, images and everything else to a file icon", () => {
    expect(contentFileType("application/pdf")).toBe("pdf");
    expect(contentFileType("image/jpeg")).toBe("img");
    expect(contentFileType("application/vnd.ms-excel")).toBe("doc");
  });
});
