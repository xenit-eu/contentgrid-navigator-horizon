import type { HalObjectShape, HalSliceShape, LinkShape } from "@contentgrid/hal/shape";

// ---- Link helpers ----

export function selfLink(href: string): LinkShape {
  return { href };
}

// ---- Sample entity: invoice ----

export const invoiceProfileBody: HalObjectShape<Record<string, unknown>> = {
  name: "invoice",
  title: "Invoice",
  _links: {
    self: { href: "/profile/invoices" },
    describes: [
      { href: "/invoices", name: "collection" },
      { href: "/invoices/{id}", name: "item", templated: true },
    ],
  },
};

export const invoiceCreateTemplate = {
  method: "POST",
  target: "/invoices",
  contentType: "application/json",
  title: "Create invoice",
  properties: [
    { name: "number", type: "text", required: true },
    { name: "date", type: "date", required: true },
    { name: "total", type: "number", required: true },
    { name: "customerId", type: "url", required: true },
    { name: "status", type: "text" },
  ],
} as const;

export const invoiceUpdateTemplate = {
  method: "PATCH",
  target: "/invoices/{id}",
  contentType: "application/json",
  title: "Update invoice",
  properties: [
    { name: "date", type: "date" },
    { name: "total", type: "number" },
    { name: "status", type: "text" },
  ],
} as const;

export const invoiceSearchTemplate = {
  method: "GET",
  target: "/invoices{?number,status}",
  title: "Search invoices",
  properties: [
    { name: "number", type: "text" },
    { name: "status", type: "text" },
  ],
} as const;

export const invoiceProfileTemplates = {
  "create-form": invoiceCreateTemplate,
  search: invoiceSearchTemplate,
} as const;

// ---- Sample entity data ----

export const sampleInvoice: HalObjectShape<{
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
  customerId: string;
}> = {
  id: "inv-001",
  number: "INV-2024-001",
  date: "2024-03-15",
  total: 1250.0,
  status: "pending",
  customerId: "cust-001",
  _links: {
    self: { href: "/invoices/inv-001" },
  },
};

export const sampleInvoiceItems: HalObjectShape<Record<string, unknown>>[] = [
  {
    id: "inv-001",
    number: "INV-2024-001",
    date: "2024-03-15",
    total: 1250.0,
    status: "pending",
    _links: { self: { href: "/invoices/inv-001" } },
  },
  {
    id: "inv-002",
    number: "INV-2024-002",
    date: "2024-03-14",
    total: 3200.0,
    status: "paid",
    _links: { self: { href: "/invoices/inv-002" } },
  },
  {
    id: "inv-003",
    number: "INV-2024-003",
    date: "2024-03-13",
    total: 875.5,
    status: "overdue",
    _links: { self: { href: "/invoices/inv-003" } },
  },
];

export const sampleInvoiceList: HalSliceShape<Record<string, unknown>> = {
  _embedded: {
    item: sampleInvoiceItems,
  },
  _links: {
    self: { href: "/invoices" },
  },
};
