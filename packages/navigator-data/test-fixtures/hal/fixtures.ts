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
  target: "/invoices",
  title: "Search invoices",
  properties: [
    { name: "number", type: "text" },
    { name: "status", type: "text" },
  ],
} as const;

export const invoiceDeleteTemplate = {
  method: "DELETE",
  target: "/invoices/{id}",
  properties: [],
} as const;

export const invoiceItemTemplates = {
  default: invoiceUpdateTemplate,
  delete: invoiceDeleteTemplate,
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

export const sampleInvoiceWithTemplates = {
  ...sampleInvoice,
  _templates: invoiceItemTemplates,
} as const;

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

// ---- Relation templates for invoice ----

export const invoiceSetSupplierTemplate = {
  method: "PUT",
  target: "/invoices/inv-001/supplier",
  contentType: "text/uri-list",
  title: "Set supplier",
  properties: [{ name: "supplier", type: "url" }],
} as const;

export const invoiceAddLineItemTemplate = {
  method: "POST",
  target: "/invoices/inv-001/lineItems",
  contentType: "text/uri-list",
  title: "Add line item",
  // options must be present so the codec treats this as multiValue (to-many)
  properties: [{ name: "lineItem", type: "url", options: {} }],
} as const;

export const invoiceClearSupplierTemplate = {
  method: "DELETE",
  target: "/invoices/inv-001/supplier",
  properties: [],
} as const;

export const invoiceRelationTemplates = {
  "set-supplier": invoiceSetSupplierTemplate,
  "add-lineItems": invoiceAddLineItemTemplate,
  "clear-supplier": invoiceClearSupplierTemplate,
} as const;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

/** Invoice item that has relation templates + cg:relation links + ETag wired */
export const sampleInvoiceWithRelationTemplates: HalObjectShape<Record<string, unknown>> = {
  ...sampleInvoice,
  _links: {
    ...sampleInvoice._links,
    [CG_RELATION_REL]: [
      { href: "/invoices/inv-001/supplier", name: "supplier" },
      { href: "/invoices/inv-001/lineItems", name: "lineItems" },
    ],
  },
  _templates: {
    ...invoiceItemTemplates,
    ...invoiceRelationTemplates,
  },
} as const;

// ---- Sample entity: supplier (to-one relation target) ----

/** A single supplier entity-item, used as the to-one relation target for invoice → supplier. */
export const sampleSupplierItem: HalObjectShape<{
  id: string;
  name: string;
  vatNumber: string;
}> = {
  id: "sup-001",
  name: "Acme Corp",
  vatNumber: "BE0123456789",
  _links: {
    self: { href: "/suppliers/sup-001" },
  },
};

// ---- Sample entity: line item (to-many relation target) ----

const sampleLineItems: HalObjectShape<Record<string, unknown>>[] = [
  {
    id: "li-001",
    description: "Widget A",
    quantity: 2,
    unitPrice: 350.0,
    _links: { self: { href: "/line-items/li-001" } },
  },
  {
    id: "li-002",
    description: "Widget B",
    quantity: 1,
    unitPrice: 550.0,
    _links: { self: { href: "/line-items/li-002" } },
  },
];

/** A HAL slice of line items, used as the to-many relation target for invoice → lineItems. */
export const sampleLineItemList: HalSliceShape<Record<string, unknown>> = {
  _embedded: {
    item: sampleLineItems,
  },
  _links: {
    self: { href: "/invoices/inv-001/lineItems" },
  },
};

/**
 * Invoice profile body that includes blueprint:relation embedded resources.
 *
 * - `supplier` — to-one relation (many_target_per_source: false), target: supplier entity
 * - `lineItems` — to-many relation (many_target_per_source: true), target: lineItem entity
 *
 * Required so EntityItem.getRelation() can join HAL templates with ProfileRelation metadata.
 */
export const invoiceProfileBodyWithRelations: HalObjectShape<Record<string, unknown>> = {
  name: "invoice",
  title: "Invoice",
  _links: {
    self: { href: "/profile/invoices" },
    describes: [
      { href: "/invoices", name: "collection" },
      { href: "/invoices/{id}", name: "item", templated: true },
    ],
  },
  _embedded: {
    [BLUEPRINT_RELATION_REL]: [
      {
        name: "supplier",
        title: "Supplier",
        description: "",
        required: false,
        many_source_per_target: false,
        many_target_per_source: false,
        _links: {
          self: { href: "/profile/invoices/relations/supplier" },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: "/profile/suppliers",
            name: "supplier",
            title: "Supplier",
          },
        },
      },
      {
        name: "lineItems",
        title: "Line Items",
        description: "",
        required: false,
        many_source_per_target: false,
        many_target_per_source: true,
        _links: {
          self: { href: "/profile/invoices/relations/lineItems" },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: "/profile/line-items",
            name: "lineItem",
            title: "Line Item",
          },
        },
      },
    ],
  },
} as const;
