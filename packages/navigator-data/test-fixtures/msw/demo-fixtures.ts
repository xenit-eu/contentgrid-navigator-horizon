/**
 * Extended demo fixtures for the dev-mode MSW worker.
 *
 * These are SEPARATE from the shared hal/fixtures.ts (which is used by
 * contract.test.ts + handlers.test.ts and must not be mutated).
 *
 * Two entities are modelled:
 *   - invoice  (has a `document` content attribute → content-focus detail view)
 *   - supplier (no content attribute → attribute-focus detail view)
 *
 * Constraints that MUST hold (smoke test at apps/navigator/tests/smoke.spec.ts):
 *   - Entity name "invoice", title "Invoice"
 *   - Exactly 3 items: inv-001, inv-002, inv-003
 */

// ---------------------------------------------------------------------------
// Supplier items
// ---------------------------------------------------------------------------

export const supplierSup001 = {
  id: "sup-001",
  name: "Northwind Logistics BV",
  vat_number: "BE0123.456.789",
  country: "Belgium",
  address: "Rue de l'Industrie 42, 1040 Brussels",
  contact_email: "accounts@northwind.example",
  active: true,
  notes: null,
  _links: {
    self: { href: "/suppliers/sup-001" },
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
    ],
    "cg:relation": [{ href: "/suppliers/sup-001/invoices", name: "invoices" }],
  },
  // HAL-FORMS templates — present means the current user has permission.
  // The platform (ABAC) omits templates for denied operations.
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
  },
};

export const supplierSup002 = {
  id: "sup-002",
  name: "Acme Industrial NV",
  vat_number: "BE0987.654.321",
  country: "Belgium",
  address: "Antwerpsesteenweg 19, 9000 Ghent",
  contact_email: "billing@acme-industrial.example",
  active: true,
  notes: "Preferred supplier for office equipment",
  _links: {
    self: { href: "/suppliers/sup-002" },
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
    ],
    "cg:relation": [{ href: "/suppliers/sup-002/invoices", name: "invoices" }],
  },
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
  },
};

export const demoSupplierItems = [supplierSup001, supplierSup002];

// ---------------------------------------------------------------------------
// Invoice items (full entity-item bodies with cg:content + cg:relation links)
// ---------------------------------------------------------------------------

export const demoInvoiceInv001 = {
  id: "inv-001",
  reference: "INV-2026-04812",
  amount: 24800.0,
  currency: "EUR",
  issue_date: "2026-05-14",
  due_date: "2026-05-21",
  notes: null,
  _links: {
    self: { href: "/invoices/inv-001" },
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
    ],
    "cg:content": [{ href: "/invoices/inv-001/document", name: "document" }],
    "cg:relation": [{ href: "/invoices/inv-001/supplier", name: "supplier" }],
  },
  // HAL-FORMS templates — present means the current user has permission.
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
    "set-supplier": { method: "PUT", contentType: "text/uri-list", properties: [] },
  },
};

export const demoInvoiceInv002 = {
  id: "inv-002",
  reference: "INV-2026-04811",
  amount: 9412.0,
  currency: "EUR",
  issue_date: "2026-05-09",
  due_date: "2026-05-23",
  notes: "Urgent payment",
  _links: {
    self: { href: "/invoices/inv-002" },
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
    ],
    "cg:content": [{ href: "/invoices/inv-002/document", name: "document" }],
    "cg:relation": [{ href: "/invoices/inv-002/supplier", name: "supplier" }],
  },
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
    "set-supplier": { method: "PUT", contentType: "text/uri-list", properties: [] },
  },
};

export const demoInvoiceInv003 = {
  id: "inv-003",
  reference: "INV-2026-04790",
  amount: 18200.0,
  currency: "USD",
  issue_date: "2026-05-02",
  due_date: "2026-05-16",
  notes: "Q1 renewal",
  _links: {
    self: { href: "/invoices/inv-003" },
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
    ],
    "cg:content": [{ href: "/invoices/inv-003/document", name: "document" }],
    "cg:relation": [{ href: "/invoices/inv-003/supplier", name: "supplier" }],
  },
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
    "set-supplier": { method: "PUT", contentType: "text/uri-list", properties: [] },
  },
};

export const demoInvoiceItems = [demoInvoiceInv001, demoInvoiceInv002, demoInvoiceInv003];

// ---------------------------------------------------------------------------
// Invoice profile body + templates (fully enriched, with attributes + relation)
// ---------------------------------------------------------------------------

/**
 * The profile HAL body for invoices.
 * The `_embedded` key carries `blueprint:attribute` and `blueprint:relation`
 * entries exactly as `fetchEntitySchema` (use-entity-schema.ts) expects.
 *
 * blueprint:attribute  → object type whose sub-attributes include filename +
 *                        mimetype + length is classified as "content"
 * blueprint:relation   → link[blueprint:target-entity] points to supplier profile
 */
export const demoInvoiceProfileBody = {
  name: "invoice",
  title: "Invoice",
  description: "Financial invoices with document attachments.",
  _links: {
    self: { href: "/profile/invoices" },
    describes: [
      { href: "/invoices", name: "collection" },
      { href: "/invoices/{id}", name: "item", templated: true },
    ],
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
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
        name: "reference",
        title: "Reference",
        type: "string",
        readOnly: false,
        required: true,
        _links: { self: { href: "/profile/invoices/reference" } },
        _embedded: {
          "blueprint:constraint": [{ type: "required" }],
        },
      },
      {
        name: "amount",
        title: "Amount",
        type: "double",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/amount" } },
      },
      {
        name: "currency",
        title: "Currency",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/currency" } },
        _embedded: {
          "blueprint:constraint": [
            {
              type: "allowed-values",
              values: ["EUR", "USD", "GBP", "JPY", "CHF"],
            },
          ],
        },
      },
      {
        name: "issue_date",
        title: "Issue date",
        type: "date",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/issue_date" } },
      },
      {
        name: "due_date",
        title: "Due date",
        type: "date",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/due_date" } },
      },
      {
        name: "notes",
        title: "Notes",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/notes" } },
      },
      // Content attribute — sub-attributes filename + mimetype + length →
      // fetchEntitySchema classifies this as type "content"
      {
        name: "document",
        title: "Document",
        type: "object",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/invoices/document" } },
        _embedded: {
          "blueprint:attribute": [
            {
              name: "filename",
              title: "Filename",
              type: "string",
              _links: { self: { href: "/profile/invoices/document/filename" } },
            },
            {
              name: "mimetype",
              title: "MIME type",
              type: "string",
              _links: { self: { href: "/profile/invoices/document/mimetype" } },
            },
            {
              name: "length",
              title: "Size",
              type: "long",
              _links: { self: { href: "/profile/invoices/document/length" } },
            },
          ],
        },
      },
    ],
    "blueprint:relation": [
      {
        name: "supplier",
        title: "Supplier",
        many_source_per_target: true,
        many_target_per_source: false,
        _links: {
          self: { href: "/profile/invoices/supplier" },
          "blueprint:target-entity": { href: "/profile/suppliers" },
        },
      },
    ],
  },
};

export const demoInvoiceProfileTemplates = {
  "create-form": {
    method: "POST",
    target: "/invoices",
    contentType: "application/json",
    title: "Create invoice",
    properties: [
      { name: "reference", type: "text", required: true },
      { name: "amount", type: "number" },
      { name: "currency", type: "text" },
      { name: "issue_date", type: "date" },
      { name: "due_date", type: "date" },
      { name: "notes", type: "text" },
      {
        name: "supplier",
        type: "url",
        maxItems: 1,
        options: { link: { href: "/suppliers" } },
      },
    ],
  },
  search: {
    method: "GET",
    target: "/invoices{?reference,currency}",
    title: "Search invoices",
    properties: [
      { name: "reference", type: "text" },
      { name: "currency", type: "text" },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Supplier profile body + templates
// ---------------------------------------------------------------------------

export const demoSupplierProfileBody = {
  name: "supplier",
  title: "Supplier",
  description: "Supplier organisations for procurement.",
  _links: {
    self: { href: "/profile/suppliers" },
    describes: [
      { href: "/suppliers", name: "collection" },
      { href: "/suppliers/{id}", name: "item", templated: true },
    ],
    curies: [
      { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
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
        name: "name",
        title: "Name",
        type: "string",
        readOnly: false,
        required: true,
        _links: { self: { href: "/profile/suppliers/name" } },
        _embedded: { "blueprint:constraint": [{ type: "required" }] },
      },
      {
        name: "vat_number",
        title: "VAT number",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/vat_number" } },
      },
      {
        name: "country",
        title: "Country",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/country" } },
      },
      {
        name: "address",
        title: "Address",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/address" } },
      },
      {
        name: "contact_email",
        title: "Contact email",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/contact_email" } },
      },
      {
        name: "active",
        title: "Active",
        type: "boolean",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/active" } },
      },
      {
        name: "notes",
        title: "Notes",
        type: "string",
        readOnly: false,
        required: false,
        _links: { self: { href: "/profile/suppliers/notes" } },
      },
    ],
    "blueprint:relation": [
      {
        name: "invoices",
        title: "Invoices",
        many_source_per_target: true,
        many_target_per_source: true,
        _links: {
          self: { href: "/profile/suppliers/invoices" },
          "blueprint:target-entity": { href: "/profile/invoices" },
        },
      },
    ],
  },
};

export const demoSupplierProfileTemplates = {
  "create-form": {
    method: "POST",
    target: "/suppliers",
    contentType: "application/json",
    title: "Create supplier",
    properties: [
      { name: "name", type: "text", required: true },
      { name: "vat_number", type: "text" },
      { name: "country", type: "text" },
      { name: "address", type: "text" },
      { name: "contact_email", type: "text" },
      { name: "active", type: "checkbox" },
      { name: "notes", type: "text" },
    ],
  },
  search: {
    method: "GET",
    target: "/suppliers{?name}",
    title: "Search suppliers",
    properties: [{ name: "name", type: "text" }],
  },
} as const;
