import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";

/**
 * An `invoice` entity with one attribute of every table-relevant kind (text, number, date,
 * boolean, and two content attributes), and a collection body of three items: one with a file
 * and an annex that can be deleted, one with neither file nor value, and one with a file only.
 */
export const INVOICE_API_URL = "https://api.example.com";
export const INVOICE_PROFILE_URL = `${INVOICE_API_URL}/profile/invoices`;
export const INVOICE_COLLECTION_URL = `${INVOICE_API_URL}/invoices`;

const attribute = (name: string, title: string, type: string, nested: unknown[] = []) => ({
  name,
  title,
  type,
  readOnly: false,
  _embedded: {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": nested,
  },
  _links: {},
});

const contentParts = [
  attribute("filename", "Filename", "string"),
  attribute("mimetype", "Mimetype", "string"),
  attribute("length", "Size", "long"),
];

export const invoiceProfileJson = {
  name: "invoice",
  title: "Invoice",
  _links: {
    self: { href: INVOICE_PROFILE_URL },
    describes: [
      { href: INVOICE_COLLECTION_URL, name: "collection" },
      { href: `${INVOICE_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
      attribute("reference", "Reference", "string"),
      attribute("amount", "Amount", "double"),
      attribute("issued", "Issue date", "date"),
      attribute("paid", "Paid", "boolean"),
      attribute("file", "File", "object", contentParts),
      attribute("annex", "Annex", "object", contentParts),
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: INVOICE_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: INVOICE_COLLECTION_URL,
      properties: [
        { name: "reference", type: "text" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            inline: [
              { property: "amount", direction: "asc", value: "amount,asc", prompt: "Amount ↑" },
              { property: "amount", direction: "desc", value: "amount,desc", prompt: "Amount ↓" },
              { property: "issued", direction: "asc", value: "issued,asc", prompt: "Issued ↑" },
            ],
          },
        },
      ],
    },
  },
};

export function makeInvoiceProfile() {
  return makeProfileEntity(invoiceProfileJson, INVOICE_PROFILE_URL, "invoice");
}

const curies = [
  { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
];

const contentLink = (id: string, name: string) => ({
  href: `${INVOICE_COLLECTION_URL}/${id}/${name}`,
  name,
});

export function invoiceCollectionBody() {
  const self = (id: string) => ({ href: `${INVOICE_COLLECTION_URL}/${id}` });
  return {
    _embedded: {
      invoice: [
        {
          id: "1",
          reference: "INV-2026-04812",
          amount: 24800,
          issued: "2026-05-14",
          paid: true,
          file: { filename: "document.pdf", mimetype: "application/pdf", length: 421888 },
          annex: { filename: "terms.pdf", mimetype: "application/pdf", length: 90112 },
          _links: {
            self: self("1"),
            "cg:content": [contentLink("1", "file"), contentLink("1", "annex")],
            curies,
          },
          _templates: {
            delete: { method: "DELETE", target: `${INVOICE_COLLECTION_URL}/1`, properties: [] },
          },
        },
        {
          id: "2",
          reference: "INV-2026-04809",
          amount: 18000,
          issued: "2026-05-02",
          paid: null,
          file: null,
          annex: null,
          _links: {
            self: self("2"),
            "cg:content": [contentLink("2", "file"), contentLink("2", "annex")],
            curies,
          },
        },
        {
          id: "3",
          reference: "INV-2026-04807",
          amount: 38000,
          issued: "2026-04-22",
          paid: false,
          file: { filename: "scan.png", mimetype: "image/png", length: 1468006 },
          annex: null,
          _links: {
            self: self("3"),
            "cg:content": [contentLink("3", "file"), contentLink("3", "annex")],
            curies,
          },
        },
      ],
    },
    _links: { self: { href: INVOICE_COLLECTION_URL }, curies },
    page: { size: 3, total_items_exact: 3 },
  };
}
