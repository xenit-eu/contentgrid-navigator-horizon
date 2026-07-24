/**
 * Shared HAL fixtures for the relation hook tests in this directory.
 *
 * All seven `use-*-relation*.test.tsx` files in `src/hooks/relation/` need the same
 * shape of data: an invoice profile with `supplier` (to-one) and/or `lineItems`
 * (to-many) blueprint:relation metadata, matching supplier/line-item target
 * profiles, a profile root that discovers a subset of those profiles, and an
 * invoice `EntityItem` wired with `cg:relation` links + arbitrary `_templates`
 * (to model ABAC allow/deny per test).
 *
 * `createInvoiceRelationFixtures()` builds all of that, parameterized by which
 * relations are modeled and which target profiles the profile root exposes
 * (some tests deliberately omit a target profile from the root to prove the
 * relation-read hooks stay disabled until it resolves).
 */
import { HttpResponse, http } from "msw";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { invoiceProfileBodyWithRelations } from "../../../test-fixtures/hal/fixtures";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import ProfileEntity from "../../accessors/entity-profile";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL } from "../test-utils";

// ---------------------------------------------------------------------------
// Shared fixture URLs
// ---------------------------------------------------------------------------

export const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
export const SUPPLIER_PROFILE_URL = `${BASE}/profile/suppliers`;
export const LINE_ITEM_PROFILE_URL = `${BASE}/profile/line-items`;
export const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
export const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
export const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;
export const SUPPLIER_ITEM_URL = `${BASE}/suppliers/sup-001`;
export const LINE_ITEM_ITEM_URL = `${BASE}/line-items/li-001`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

/** The two relations modeled on the shared invoice fixture. */
export type InvoiceRelationName = "supplier" | "lineItems";

export interface CreateInvoiceRelationFixturesOptions {
  /**
   * Which relations are embedded in the invoice profile's blueprint:relation
   * metadata and wired as `cg:relation` links on the invoice item.
   * Defaults to both.
   */
  relations?: readonly InvoiceRelationName[];
  /**
   * Which target profiles the profile root exposes via `cg:entity` (and thus
   * which profile MSW handlers `setupProfileHandlers()` registers). Defaults
   * to `relations`. Some tests deliberately narrow this to prove a relation
   * read hook stays disabled until its target profile resolves.
   */
  rootProfiles?: readonly InvoiceRelationName[];
  /** Extra `_templates` to merge onto the line-item profile body (e.g. a search template). */
  lineItemProfileTemplates?: Record<string, unknown>;
}

/**
 * Builds the shared invoice/supplier/line-item HAL profile fixtures + factories
 * used across the relation hook tests. See module doc for rationale.
 */
export function createInvoiceRelationFixtures(options: CreateInvoiceRelationFixturesOptions = {}) {
  const relations = options.relations ?? ["supplier", "lineItems"];
  const rootProfiles = options.rootProfiles ?? relations;
  const includesSupplier = relations.includes("supplier");
  const includesLineItems = relations.includes("lineItems");
  const rootHasSupplier = rootProfiles.includes("supplier");
  const rootHasLineItem = rootProfiles.includes("lineItems");

  // ---------------------------------------------------------------------------
  // Profile root — discovers whichever target profiles this test needs.
  // ---------------------------------------------------------------------------

  const profileRootBody = {
    _links: {
      self: { href: PROFILE_URL },
      "cg:entity": [
        { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
        ...(rootHasSupplier
          ? [{ href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" }]
          : []),
        ...(rootHasLineItem
          ? [{ href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" }]
          : []),
      ],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
    _templates: {},
  };

  // ---------------------------------------------------------------------------
  // Target profiles — supplier (to-one target) + line item (to-many target).
  // The `describes` array includes the absolute profile URL as a non-templated
  // entry so `ProfileEntity.describes()` matches the blueprint:target-entity href.
  // ---------------------------------------------------------------------------

  const supplierProfileBody = {
    name: "supplier",
    title: "Supplier",
    description: "",
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _links: {
      self: { href: SUPPLIER_PROFILE_URL, title: "Supplier" },
      describes: [
        { href: SUPPLIER_PROFILE_URL },
        { href: `${BASE}/suppliers`, name: "collection" },
        { href: `${BASE}/suppliers/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _templates: {},
  };

  const lineItemProfileBody = {
    name: "lineItem",
    title: "Line Item",
    description: "",
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _links: {
      self: { href: LINE_ITEM_PROFILE_URL, title: "Line Item" },
      describes: [
        { href: LINE_ITEM_PROFILE_URL },
        { href: `${BASE}/line-items`, name: "collection" },
        { href: `${BASE}/line-items/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _templates: options.lineItemProfileTemplates ?? {},
  };

  // ---------------------------------------------------------------------------
  // Invoice profile — blueprint:relation entries for the requested relations,
  // with absolute blueprint:target-entity hrefs so getTargetProfile() can
  // resolve supplier/lineItem profiles from the loaded profile list.
  // ---------------------------------------------------------------------------

  const invoiceProfileBody = {
    ...invoiceProfileBodyWithRelations,
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _embedded: {
      [BLUEPRINT_RELATION_REL]: [
        ...(includesSupplier
          ? [
              {
                name: "supplier",
                title: "Supplier",
                description: "",
                required: false,
                many_source_per_target: false,
                many_target_per_source: false,
                _links: {
                  self: { href: `${INVOICE_PROFILE_URL}/relations/supplier` },
                  [BLUEPRINT_TARGET_ENTITY_REL]: {
                    href: SUPPLIER_PROFILE_URL,
                    name: "supplier",
                    title: "Supplier",
                  },
                },
              },
            ]
          : []),
        ...(includesLineItems
          ? [
              {
                name: "lineItems",
                title: "Line Items",
                description: "",
                required: false,
                many_source_per_target: false,
                many_target_per_source: true,
                _links: {
                  self: { href: `${INVOICE_PROFILE_URL}/relations/lineItems` },
                  [BLUEPRINT_TARGET_ENTITY_REL]: {
                    href: LINE_ITEM_PROFILE_URL,
                    name: "lineItem",
                    title: "Line Item",
                  },
                },
              },
            ]
          : []),
      ],
    },
  };

  // ---------------------------------------------------------------------------
  // Profile factories
  // ---------------------------------------------------------------------------

  function makeInvoiceProfile(): ProfileEntity {
    const hal = new HalObject<ProfileEntityShape>(
      invoiceProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
    );
    return new ProfileEntity(
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
      hal,
    );
  }

  function makeSupplierProfile(): ProfileEntity {
    const hal = new HalObject<ProfileEntityShape>(
      supplierProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
    );
    return new ProfileEntity(
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" } as unknown as Link,
      hal,
    );
  }

  function makeLineItemProfile(): ProfileEntity {
    const hal = new HalObject<ProfileEntityShape>(
      lineItemProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
    );
    return new ProfileEntity(
      { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" } as unknown as Link,
      hal,
    );
  }

  // ---------------------------------------------------------------------------
  // Invoice item factory — cg:relation links for the requested relations,
  // arbitrary `_templates` (models ABAC allow/deny per test).
  // ---------------------------------------------------------------------------

  function makeEntityItemWithTemplates(
    etag: string | null = '"v1"',
    templates: Record<string, unknown> = {},
  ): EntityItem {
    const itemProfile = makeInvoiceProfile();
    const itemBody = {
      id: "inv-001",
      _links: {
        self: { href: INVOICE_ITEM_URL },
        [CG_RELATION_REL]: [
          ...(includesSupplier ? [{ href: SUPPLIER_RELATION_URL, name: "supplier" }] : []),
          ...(includesLineItems ? [{ href: LINE_ITEMS_RELATION_URL, name: "lineItems" }] : []),
        ],
      },
      _templates: templates,
    };
    const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
    return new EntityItem(hal, itemProfile, etag);
  }

  /** Register MSW GET handlers for the profile root + invoice + whichever target profiles are rooted. */
  function setupProfileHandlers() {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
      ...(rootHasSupplier
        ? [http.get(SUPPLIER_PROFILE_URL, () => HttpResponse.json(supplierProfileBody))]
        : []),
      ...(rootHasLineItem
        ? [http.get(LINE_ITEM_PROFILE_URL, () => HttpResponse.json(lineItemProfileBody))]
        : []),
    );
  }

  return {
    profileRootBody,
    invoiceProfileBody,
    supplierProfileBody,
    lineItemProfileBody,
    makeInvoiceProfile,
    makeSupplierProfile,
    makeLineItemProfile,
    makeEntityItemWithTemplates,
    setupProfileHandlers,
  };
}

// ---------------------------------------------------------------------------
// Relation accessors — shared "get or throw" helpers used by the mutation-hook
// tests to pull a typed relation off a freshly-built invoice EntityItem.
// ---------------------------------------------------------------------------

export function getToOneRelationOrThrow(
  entityItem: EntityItem,
  name: string,
): EntityItemToOneRelation {
  const rel = entityItem.getToOneRelation(name);
  if (!rel) throw new Error(`${name} to-one relation not found on item`);
  return rel;
}

export function getToManyRelationOrThrow(
  entityItem: EntityItem,
  name: string,
): EntityItemToManyRelation {
  const rel = entityItem.getToManyRelation(name);
  if (!rel) throw new Error(`${name} to-many relation not found on item`);
  return rel;
}
