/**
 * Tests for useEntityItemToManyRelation hook.
 *
 * Focus: hook wiring and `enabled` gating (static factory paths are covered in the accessor tests).
 *
 * (a) Returns an EntityItemCollection when the target profile resolves via useProfileEntities.
 * (b) Query is disabled (isPending, fetchStatus idle, no fetch) until the target profile resolves.
 * (c) `{ url }` mode fetches the given page URL directly.
 * (d) `{ searchValues }` mode fetches a relation-scoped search URL.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import {
  invoiceProfileBodyWithRelations,
  sampleInvoiceWithRelationTemplates,
  sampleLineItemList,
} from "../../../test-fixtures/hal/fixtures";
import { createListHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import ProfileEntity from "../../accessors/entity-profile";
import { cgRels } from "../../api";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL, makeWrapper } from "../test-utils";
import { useEntityItemToManyRelation } from "./use-entity-item-to-many-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const LINE_ITEM_PROFILE_URL = `${BASE}/profile/line-items`;
const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;

// Canonical full URI of the cg:relation link relation (used as object key in HAL shapes).
const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Profile root that exposes both invoice and line-item profiles.
 * Needed so useProfileEntities can discover the line-item profile link.
 */
const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" },
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
 * Line-item profile body — describes /line-items/{id} items.
 *
 * The `describes` array includes the profile URL itself as a non-templated entry.
 * This makes `ProfileEntity.describes({ href: LINE_ITEM_PROFILE_URL })` return `true`,
 * which allows `ProfileRelation.getTargetProfile()` (which uses `profile.describes()`)
 * to match the line-item profile from the blueprint:target-entity link href.
 */
const lineItemProfileBody = {
  name: "lineItem",
  title: "Line Item",
  description: "",
  _embedded: {
    "blueprint:attribute": [],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: LINE_ITEM_PROFILE_URL, title: "Line Item" },
    describes: [
      // Include the absolute profile URL so getTargetProfile can match via describes()
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
  _templates: {
    search: {
      method: "GET",
      target: `${BASE}/line-items`,
      properties: [{ name: "description~prefix", type: "text" }],
    },
  },
};

const LINE_ITEMS_COLLECTION_URL = `${BASE}/line-items`;

/**
 * Invoice profile body — contains blueprint:relation entries for supplier + lineItems.
 *
 * The blueprint:target-entity href uses the ABSOLUTE line-item profile URL so it matches
 * the LINE_ITEM_PROFILE_URL that useProfileEntities uses as the cg:entity link href.
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
            href: `${BASE}/profile/suppliers`,
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
            // Use the absolute profile URL so getTargetProfile can resolve it
            href: LINE_ITEM_PROFILE_URL,
            name: "lineItem",
            title: "Line Item",
          },
        },
      },
    ],
  },
};

function makeLineItemProfile(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    lineItemProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" } as unknown as Link,
    hal,
  );
}

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
 * Build an EntityItem for inv-001 with the cg:relation link for lineItems pointing
 * to the absolute LINE_ITEMS_RELATION_URL so MSW can intercept it.
 */
function makeInvoiceItem(etag: string | null = '"v1"'): EntityItem {
  const body = {
    ...sampleInvoiceWithRelationTemplates,
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_RELATION_REL]: [
        { href: `${INVOICE_ITEM_URL}/supplier`, name: "supplier" },
        { href: LINE_ITEMS_RELATION_URL, name: "lineItems" },
      ],
    },
  };
  const hal = new HalObject<EntityItemShape>(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, makeInvoiceProfile(), etag);
}

/**
 * Build the lineItems relation from the invoice item.
 * The profile relation is resolved from the invoice profile's blueprint:relation metadata.
 */
function makeLineItemsRelation(etag: string | null = '"v1"'): EntityItemToManyRelation {
  const item = makeInvoiceItem(etag);
  const link = item.halItem.links.findLink(cgRels.relation, "lineItems");
  if (!link) throw new Error("lineItems cg:relation link not found");
  const profileRelation = item.profileEntity.getRelation("lineItems");
  if (!profileRelation) throw new Error("lineItems profile relation not found in invoice profile");
  return new EntityItemToManyRelation("lineItems", link, profileRelation, item);
}

/** Register MSW handlers for the profile root + both entity profiles. */
function setupProfileHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    http.get(LINE_ITEM_PROFILE_URL, () => HttpResponse.json(lineItemProfileBody)),
  );
}

// ---------------------------------------------------------------------------
// (a) Returns an EntityItemCollection when the target profile resolves
// ---------------------------------------------------------------------------

describe("useEntityItemToManyRelation — returns collection when target profile resolves", () => {
  it("returns an EntityItemCollection with the correct number of items", async () => {
    setupProfileHandlers();
    server.use(
      createListHandler({
        url: LINE_ITEMS_RELATION_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );

    const relation = makeLineItemsRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToManyRelation(relation), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toBeInstanceOf(EntityItemCollection);
    expect(result.current.data?.items).toHaveLength(2);
  });

  it("returns item ids from the collection", async () => {
    setupProfileHandlers();
    server.use(
      createListHandler({
        url: LINE_ITEMS_RELATION_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );

    const relation = makeLineItemsRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToManyRelation(relation), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    const ids = result.current.data?.items.map((item) => item.id);
    expect(ids).toContain("li-001");
    expect(ids).toContain("li-002");
  });
});

// ---------------------------------------------------------------------------
// (b) Query is disabled until the target profile resolves
// ---------------------------------------------------------------------------

describe("useEntityItemToManyRelation — disabled until target profile resolves", () => {
  it("is pending with fetchStatus idle (no fetch) while profile root is loading", async () => {
    // Profile root responds only after we release it — relation collection must NOT be fetched yet
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
      http.get(LINE_ITEM_PROFILE_URL, () => HttpResponse.json(lineItemProfileBody)),
      // No handler for LINE_ITEMS_RELATION_URL: MSW will warn if it gets hit early
    );

    const relation = makeLineItemsRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToManyRelation(relation), { wrapper });

    // Before profile root resolves, query must be disabled
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");

    // Release the profile root and confirm the query eventually succeeds
    server.use(
      createListHandler({
        url: LINE_ITEMS_RELATION_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );
    resolveRoot();
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeInstanceOf(EntityItemCollection);
  });
});

// ---------------------------------------------------------------------------
// (c) `{ url }` mode — fetches a specific page URL directly
// ---------------------------------------------------------------------------

describe("useEntityItemToManyRelation — { url } mode", () => {
  it("fetches the given page URL instead of the relation's default link", async () => {
    setupProfileHandlers();
    const pageUrl = `${LINE_ITEMS_RELATION_URL}?_cursor=page2`;
    server.use(
      createListHandler({
        url: pageUrl,
        items: [{ id: "li-003", description: "Widget C", _links: { self: { href: "/x" } } }],
      }),
    );
    // No handler registered for LINE_ITEMS_RELATION_URL itself — by-url mode must not fetch it.

    const relation = makeLineItemsRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToManyRelation(relation, { url: pageUrl }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toBeInstanceOf(EntityItemCollection);
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["li-003"]);
  });
});

// ---------------------------------------------------------------------------
// (d) `{ searchValues }` mode — relation-scoped search
// ---------------------------------------------------------------------------

describe("useEntityItemToManyRelation — { searchValues } mode", () => {
  it("fetches the relation's base page to extract scoping params, then the scoped search URL", async () => {
    setupProfileHandlers();
    server.use(
      // Base fetch (used to extract internalRelationParams from self href)
      createListHandler({
        url: LINE_ITEMS_RELATION_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
      // Scoped search fetch — returns a distinct item so we can tell it apart from the base fetch
      http.get(LINE_ITEMS_COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: LINE_ITEMS_COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "li-099",
                description: "Widget Searched",
                _links: { self: { href: `${LINE_ITEMS_COLLECTION_URL}/li-099` } },
              },
            ],
          },
          page: { size: 1, total_items_exact: 1 },
        }),
      ),
    );

    const relation = makeLineItemsRelation();
    // Build values off the resolved profile's own searchTemplate — createValues()
    // requires an actual HalFormsTemplate instance, not the raw fixture object.
    const searchValues = createValues(makeLineItemProfile().searchTemplate!.template).withValue(
      "description~prefix",
      "Widget",
    );
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useEntityItemToManyRelation(relation, { searchValues }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toBeInstanceOf(EntityItemCollection);
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["li-099"]);
  });

  it("stays pending (disabled) while searchValues is undefined", async () => {
    setupProfileHandlers();
    server.use(
      createListHandler({
        url: LINE_ITEMS_RELATION_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );

    const relation = makeLineItemsRelation();
    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useEntityItemToManyRelation(relation, { searchValues: undefined }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
