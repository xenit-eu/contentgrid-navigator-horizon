/**
 * Tests for useEntityItemToOneRelation hook.
 *
 * Focus: hook wiring and `enabled` gating (static factory paths are covered in the accessor tests).
 *
 * (a) Returns the target EntityItem when the target profile resolves via useProfileEntities.
 * (b) Returns null when the relation slot is empty (server responds with 404).
 * (c) Query is disabled (isPending, fetchStatus idle, no fetch) until the target profile resolves.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import {
  invoiceProfileBodyWithRelations,
  sampleInvoiceWithRelationTemplates,
  sampleSupplierItem,
} from "../../test-fixtures/hal/fixtures";
import { createEntityHandler, createProblemHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import ProfileEntity from "../accessors/entity-profile";
import { cgRels } from "../api";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, PROFILE_URL, makeWrapper } from "./test-utils";
import { useEntityItemToOneRelation } from "./use-entity-item-to-one-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const SUPPLIER_PROFILE_URL = `${BASE}/profile/suppliers`;
const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const SUPPLIER_ITEM_URL = `${BASE}/suppliers/sup-001`;

// Canonical full URI of the cg:relation link relation (used as object key in HAL shapes).
const CG_RELATION_REL_STRING = "https://contentgrid.cloud/rels/contentgrid/relation";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Profile root that exposes both invoice and supplier profiles.
 * Needed so useProfileEntities can discover the supplier profile link.
 */
const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

/**
 * Supplier profile body — describes /suppliers/{id} items.
 *
 * The `describes` array includes the profile URL itself as a non-templated entry.
 * This makes `ProfileEntity.describes({ href: SUPPLIER_PROFILE_URL })` return `true`,
 * which allows `ProfileRelation.getTargetProfile()` (which uses `profile.describes()`)
 * to match the supplier profile from the blueprint:target-entity link href.
 */
const supplierProfileBody = {
  name: "supplier",
  title: "Supplier",
  description: "",
  _embedded: {
    "blueprint:attribute": [],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: SUPPLIER_PROFILE_URL, title: "Supplier" },
    describes: [
      // Include the absolute profile URL so getTargetProfile can match via describes()
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

/**
 * Invoice profile body — contains blueprint:relation entries for supplier + lineItems.
 *
 * The blueprint:target-entity href uses the ABSOLUTE supplier profile URL so it matches
 * the SUPPLIER_PROFILE_URL that useProfileEntities uses as the cg:entity link href.
 */
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
            // Use the absolute profile URL so getTargetProfile can resolve it
            href: SUPPLIER_PROFILE_URL,
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
          self: { href: `${INVOICE_PROFILE_URL}/relations/lineItems` },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: `${BASE}/profile/line-items`,
            name: "lineItem",
            title: "Line Item",
          },
        },
      },
    ],
  },
};

function makeInvoiceProfile(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    invoiceProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal,
  );
}

/**
 * Build an EntityItem for inv-001 with the cg:relation link for supplier pointing
 * to the absolute SUPPLIER_RELATION_URL so MSW can intercept it.
 */
function makeInvoiceItem(etag: string | null = '"v1"'): EntityItem {
  const body = {
    ...sampleInvoiceWithRelationTemplates,
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_RELATION_REL_STRING]: [
        { href: SUPPLIER_RELATION_URL, name: "supplier" },
        { href: `${INVOICE_ITEM_URL}/lineItems`, name: "lineItems" },
      ],
    },
  };
  const hal = new HalObject<EntityItemShape>(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, makeInvoiceProfile(), etag);
}

/**
 * Build the supplier relation from the invoice item.
 * The profile relation is resolved from the invoice profile's blueprint:relation metadata.
 */
function makeSupplierRelation(etag: string | null = '"v1"'): EntityItemToOneRelation {
  const item = makeInvoiceItem(etag);
  const link = item.halItem.links.findLink(cgRels.relation, "supplier");
  if (!link) throw new Error("supplier cg:relation link not found");
  const profileRelation = item.profileEntity.getRelation("supplier");
  if (!profileRelation) throw new Error("supplier profile relation not found in invoice profile");
  return new EntityItemToOneRelation("supplier", link, profileRelation, item);
}

/** Register MSW handlers for the profile root + both entity profiles. */
function setupProfileHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    http.get(SUPPLIER_PROFILE_URL, () => HttpResponse.json(supplierProfileBody)),
  );
}

// ---------------------------------------------------------------------------
// (a) Returns the target EntityItem when the target profile resolves
// ---------------------------------------------------------------------------

describe("useEntityItemToOneRelation — returns item when target profile resolves", () => {
  it("returns an EntityItem with the correct id", async () => {
    setupProfileHandlers();
    server.use(
      createEntityHandler({
        url: SUPPLIER_RELATION_URL,
        body: {
          ...sampleSupplierItem,
          _links: { self: { href: SUPPLIER_ITEM_URL } },
        },
      }),
    );

    const relation = makeSupplierRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToOneRelation(relation), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect((result.current.data as EntityItem).id).toBe("sup-001");
  });
});

// ---------------------------------------------------------------------------
// (b) Returns null for an empty relation slot (404)
// ---------------------------------------------------------------------------

describe("useEntityItemToOneRelation — returns null for empty slot (404)", () => {
  it("returns null when the server responds with 404", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "get",
        url: SUPPLIER_RELATION_URL,
        status: 404,
        type: "not-found/entity-item",
      }),
    );

    // The factory has retry:3 by default; override to avoid fake timers
    const relation = makeSupplierRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemToOneRelation(relation, { queryOptionsOverride: { retry: false } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (c) Query is disabled until the target profile resolves
// ---------------------------------------------------------------------------

describe("useEntityItemToOneRelation — disabled until target profile resolves", () => {
  it("is pending with fetchStatus idle (no fetch) while profile root is loading", async () => {
    // Profile root responds only after we release it — target item must NOT be fetched yet
    let resolveRoot!: () => void;
    const rootDelay = new Promise<void>((res) => {
      resolveRoot = res;
    });

    server.use(
      http.get(PROFILE_URL, async () => {
        await rootDelay;
        return HttpResponse.json(profileRootBody);
      }),
      http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
      http.get(SUPPLIER_PROFILE_URL, () => HttpResponse.json(supplierProfileBody)),
      // Registering no handler for SUPPLIER_RELATION_URL: MSW will warn if it gets hit
    );

    const relation = makeSupplierRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToOneRelation(relation), { wrapper });

    // Before profile root resolves, query must be disabled
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");

    // Release the profile root and confirm the query eventually succeeds
    // (we just wire a simple entity handler for the actual relation fetch)
    server.use(
      createEntityHandler({
        url: SUPPLIER_RELATION_URL,
        body: {
          ...sampleSupplierItem,
          _links: { self: { href: SUPPLIER_ITEM_URL } },
        },
      }),
    );
    resolveRoot();
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeInstanceOf(EntityItem);
  });
});
