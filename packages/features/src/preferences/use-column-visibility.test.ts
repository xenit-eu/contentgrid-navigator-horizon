import { describe, expect, it } from "vitest";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { type ColumnVisibilityConfig, buildColumns } from "./use-column-visibility";

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
