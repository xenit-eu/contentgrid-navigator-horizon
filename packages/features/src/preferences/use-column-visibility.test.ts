import { describe, expect, it } from "vitest";
import {
  type EntityItem,
  type EntityItemAttribute,
  EntityItemAttributeContent,
  EntityItemAttributeNested,
  EntityItemAttributePlain,
  EntityItemAttributeUnknown,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { type ColumnVisibilityConfig, buildColumns, buildRows } from "./use-column-visibility";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const INVOICE_PROFILE_URL = `${PROFILE_URL}/invoices`;

function invoiceProfileJson() {
  return {
    name: "invoice",
    title: "Invoice",
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${API_URL}/invoices`, name: "collection", title: "Invoices" },
        { href: `${API_URL}/invoices/{id}`, name: "item", title: "Invoice", templated: true },
      ],
      curies: [
        {
          name: "blueprint",
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          templated: true,
        },
      ],
    },
    _embedded: {
      "blueprint:attribute": [
        {
          name: "id",
          title: "ID",
          type: "string",
          readOnly: true,
          _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
          _links: {},
        },
        {
          name: "invoice_number",
          title: "Invoice Number",
          type: "string",
          readOnly: false,
          _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
          _links: {},
        },
        {
          name: "created_by",
          title: "Created By",
          type: "string",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [{ type: "created-by" }],
            "blueprint:search-param": [],
          },
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {},
  };
}

function makeVisibility(visibleColumns: string[]): ColumnVisibilityConfig {
  return {
    visibleColumns,
    isVisible: (columnName) => visibleColumns.includes(columnName),
  };
}

function makeItem(id: string, attributes: Record<string, EntityItemAttribute>): EntityItem {
  return {
    id,
    findAttribute: (name: string) => attributes[name],
  } as unknown as EntityItem;
}

describe("buildRows", () => {
  const COLUMNS = [
    { key: "id", header: "ID" },
    { key: "document", header: "Document" },
    { key: "address", header: "Address" },
    { key: "extra", header: "Extra" },
    { key: "invoice_number", header: "Invoice Number" },
    { key: "missing", header: "Missing" },
  ];

  it("reads the id column straight off item.id, not through findAttribute", () => {
    const item = makeItem("inv-1", {});
    const [row] = buildRows([item], [{ key: "id", header: "ID" }]);
    expect(row.id).toBe("inv-1");
    expect(row.data.id).toBe("inv-1");
  });

  it("formats a content attribute as 'filename · size' instead of the raw metadata object", () => {
    const item = makeItem("inv-1", {
      document: {
        value: new EntityItemAttributeContent(
          "document",
          { filename: "invoice.pdf", mimetype: "application/pdf", length: 2048 },
          { href: "/invoices/inv-1/document" } as never,
        ),
      },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.document).toBe("invoice.pdf · 2.0 kB");
  });

  it("falls back to 'Untitled' for a content attribute with no filename", () => {
    const item = makeItem("inv-1", {
      document: {
        value: new EntityItemAttributeContent(
          "document",
          { filename: null, mimetype: "application/pdf", length: 512 },
          { href: "/invoices/inv-1/document" } as never,
        ),
      },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.document).toBe("Untitled · 0.5 kB");
  });

  it("renders null (not an object) for a content attribute with no uploaded content yet", () => {
    const item = makeItem("inv-1", {
      document: {
        value: new EntityItemAttributeContent("document", null, {
          href: "/invoices/inv-1/document",
        } as never),
      },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.document).toBeNull();
  });

  it("renders null (not '[object Object]') for a nested/object attribute", () => {
    const item = makeItem("inv-1", {
      address: { value: new EntityItemAttributeNested("address", { city: "Ghent" }) },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.address).toBeNull();
  });

  it("renders null for an unknown/unsupported attribute kind", () => {
    const item = makeItem("inv-1", {
      extra: { value: new EntityItemAttributeUnknown("extra") },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.extra).toBeNull();
  });

  it("renders a plain attribute's own value", () => {
    const item = makeItem("inv-1", {
      invoice_number: { value: new EntityItemAttributePlain("invoice_number", "INV-042") },
    });
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.invoice_number).toBe("INV-042");
  });

  it("renders an empty string for a column with no matching attribute on the item", () => {
    const item = makeItem("inv-1", {});
    const [row] = buildRows([item], COLUMNS);
    expect(row.data.missing).toBe("");
  });
});

describe("buildColumns", () => {
  const profile = makeProfileEntity(invoiceProfileJson(), INVOICE_PROFILE_URL, "invoice");

  it("includes an audit attribute column when it is marked visible", () => {
    const columns = buildColumns(profile, makeVisibility(["id", "created_by"]));

    expect(columns.map((col) => col.key)).toEqual(["id", "created_by"]);
    expect(columns[1].header).toBe("Created By");
  });

  it("omits an audit attribute column when it is not marked visible", () => {
    const columns = buildColumns(profile, makeVisibility(["id", "invoice_number"]));

    expect(columns.map((col) => col.key)).toEqual(["id", "invoice_number"]);
  });
});
