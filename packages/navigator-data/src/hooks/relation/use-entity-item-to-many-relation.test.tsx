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
import { createValues } from "@contentgrid/hal-forms/values";
import { sampleLineItemList } from "../../../test-fixtures/hal/fixtures";
import { createListHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import type { EntityItem } from "../../accessors/entity-item";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { cgRels } from "../../api";
import { BASE, PROFILE_URL, makeWrapper } from "../test-utils";
import {
  INVOICE_PROFILE_URL,
  LINE_ITEMS_RELATION_URL,
  LINE_ITEM_PROFILE_URL,
  createInvoiceRelationFixtures,
} from "./relation-test-fixtures";
import { useEntityItemToManyRelation } from "./use-entity-item-to-many-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const LINE_ITEMS_COLLECTION_URL = `${BASE}/line-items`;

// ---------------------------------------------------------------------------
// Fixture factories
//
// Root only exposes the invoice + line-item profiles (not supplier) — the
// invoice profile still embeds both relations, but this suite only ever
// resolves the lineItems target profile, matching the original fixture.
// ---------------------------------------------------------------------------

const {
  profileRootBody,
  invoiceProfileBody,
  lineItemProfileBody,
  makeLineItemProfile,
  makeEntityItemWithTemplates,
  setupProfileHandlers,
} = createInvoiceRelationFixtures({
  rootProfiles: ["lineItems"],
  lineItemProfileTemplates: {
    search: {
      method: "GET",
      target: `${BASE}/line-items`,
      properties: [{ name: "description~prefix", type: "text" }],
    },
  },
});

/**
 * Build the lineItems relation from the invoice item.
 * The profile relation is resolved from the invoice profile's blueprint:relation metadata.
 */
function makeLineItemsRelation(etag: string | null = '"v1"'): EntityItemToManyRelation {
  const item: EntityItem = makeEntityItemWithTemplates(etag, {});
  const link = item.halItem.links.findLink(cgRels.relation, "lineItems");
  if (!link) throw new Error("lineItems cg:relation link not found");
  const profileRelation = item.profileEntity.getRelation("lineItems");
  if (!profileRelation) throw new Error("lineItems profile relation not found in invoice profile");
  return new EntityItemToManyRelation("lineItems", link, profileRelation, item);
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
