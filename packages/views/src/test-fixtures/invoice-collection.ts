import { API, PROFILE_URL } from "./item-detail";

/**
 * Hand-built HAL responses for an `invoice` entity that exercises the collection table's cell
 * kinds: text, number, date, datetime, boolean and two content attributes, over eight items (some
 * without a file, one an image, one that cannot be deleted). Sample data only.
 */
export const INVOICE_PROFILE_URL = `${API}/profile/invoices`;
export const INVOICE_COLLECTION_URL = `${API}/invoices`;

const attribute = (name: string, title: string, type: string, nested: unknown[] = []) => ({
  name,
  title,
  type,
  description: null,
  readOnly: false,
  required: false,
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

const sortOption = (property: string, direction: "asc" | "desc", prompt: string) => ({
  property,
  direction,
  value: `${property},${direction}`,
  prompt,
});

const rootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [{ href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" }],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const profileBody = {
  name: "invoice",
  title: "Invoice",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      attribute("id", "id", "string"),
      attribute("reference", "Invoice", "string"),
      attribute("supplier", "Supplier", "string"),
      attribute("amount", "Amount", "double"),
      attribute("issued", "Issue date", "date"),
      attribute("received", "Received", "datetime"),
      attribute("paid", "Paid", "boolean"),
      attribute("file", "File", "object", contentParts),
      attribute("annex", "Annex", "object", contentParts),
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: INVOICE_PROFILE_URL, title: "Invoice" },
    describes: [
      { href: INVOICE_COLLECTION_URL, title: "Invoices", name: "collection" },
      { href: `${INVOICE_COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {
    search: {
      method: "GET",
      target: INVOICE_COLLECTION_URL,
      properties: [
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            inline: [
              sortOption("reference", "asc", "Invoice A→Z"),
              sortOption("reference", "desc", "Invoice Z→A"),
              sortOption("amount", "asc", "Amount low→high"),
              sortOption("amount", "desc", "Amount high→low"),
              sortOption("issued", "asc", "Issue date oldest"),
              sortOption("issued", "desc", "Issue date newest"),
            ],
          },
        },
      ],
    },
  },
};

const curies = [
  { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
];

type SampleFile = { filename: string; mimetype: string; length: number } | null;

const pdf = (filename: string, length: number): SampleFile => ({
  filename,
  mimetype: "application/pdf",
  length,
});

const SAMPLES: readonly {
  reference: string;
  amount: number;
  issued: string;
  received: string;
  paid: boolean | null;
  file: SampleFile;
  annex: SampleFile;
  deletable: boolean;
}[] = [
  {
    reference: "INV-2026-04812",
    amount: 24800,
    issued: "2026-05-14",
    received: "2026-05-15T09:12:00Z",
    paid: true,
    file: pdf("document.pdf", 421888),
    annex: pdf("terms.pdf", 90112),
    deletable: true,
  },
  {
    reference: "INV-2026-04811",
    amount: 9412.5,
    issued: "2026-05-09",
    received: "2026-05-11T16:40:00Z",
    paid: false,
    file: pdf("document.pdf", 192512),
    annex: null,
    deletable: true,
  },
  {
    reference: "INV-2026-04810",
    amount: 142300,
    issued: "2026-05-07",
    received: "2026-05-08T08:05:00Z",
    paid: false,
    file: pdf("scan.pdf", 1468006),
    annex: pdf("note.pdf", 54272),
    deletable: false,
  },
  {
    reference: "INV-2026-04809",
    amount: 18000,
    issued: "2026-05-02",
    received: "2026-05-04T13:27:00Z",
    paid: null,
    file: null,
    annex: null,
    deletable: true,
  },
  {
    reference: "INV-2026-04807",
    amount: 38000,
    issued: "2026-04-22",
    received: "2026-04-23T10:02:00Z",
    paid: true,
    file: { filename: "scan.png", mimetype: "image/png", length: 1468006 },
    annex: { filename: "receipt.jpg", mimetype: "image/jpeg", length: 1153434 },
    deletable: true,
  },
  {
    reference: "INV-2026-04806",
    amount: 12500,
    issued: "2026-04-18",
    received: "2026-04-20T15:48:00Z",
    paid: true,
    file: pdf("contract-invoice.docx", 626688),
    annex: null,
    deletable: true,
  },
  {
    reference: "INV-2026-04798",
    amount: 1180.4,
    issued: "2026-04-11",
    received: "2026-04-13T09:30:00Z",
    paid: true,
    file: pdf("document.pdf", 98304),
    annex: null,
    deletable: true,
  },
  {
    reference: "INV-2026-04790",
    amount: 18200,
    issued: "2026-04-02",
    received: "2026-04-03T11:15:00Z",
    paid: true,
    file: pdf("document.pdf", 207872),
    annex: pdf("terms.pdf", 93184),
    deletable: true,
  },
];

const contentLink = (id: string, name: string) => ({
  href: `${INVOICE_COLLECTION_URL}/${id}/${name}`,
  name,
});

const collectionBody = {
  _embedded: {
    invoice: SAMPLES.map((sample, index) => {
      const id = `inv-${String(index + 1).padStart(3, "0")}`;
      const href = `${INVOICE_COLLECTION_URL}/${id}`;
      return {
        id,
        reference: sample.reference,
        supplier: "Northwind Logistics",
        amount: sample.amount,
        issued: sample.issued,
        received: sample.received,
        paid: sample.paid,
        file: sample.file,
        annex: sample.annex,
        _links: {
          self: { href },
          "cg:content": [contentLink(id, "file"), contentLink(id, "annex")],
          curies,
        },
        ...(sample.deletable
          ? { _templates: { delete: { method: "DELETE", target: href, properties: [] } } }
          : {}),
      };
    }),
  },
  _links: {
    self: { href: INVOICE_COLLECTION_URL },
    next: { href: `${INVOICE_COLLECTION_URL}?_cursor=page2` },
    curies,
  },
  page: { size: SAMPLES.length, total_items_exact: 99 },
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/hal+json" } });

/** A fetch that answers the invoice fixture: the profile root, the invoice profile and its list. */
export function createInvoiceCollectionFixtureFetch() {
  return async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === PROFILE_URL) return json(rootBody);
    if (url === INVOICE_PROFILE_URL) return json(profileBody);
    if (url === INVOICE_COLLECTION_URL || url.startsWith(`${INVOICE_COLLECTION_URL}?`)) {
      return json(collectionBody);
    }
    return new Response(null, { status: 404 });
  };
}
