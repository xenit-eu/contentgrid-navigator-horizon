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
import { sampleSupplierItem } from "../../../test-fixtures/hal/fixtures";
import { createEntityHandler, createProblemHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { cgRels } from "../../api";
import { PROFILE_URL, makeWrapper } from "../test-utils";
import {
  INVOICE_PROFILE_URL,
  SUPPLIER_ITEM_URL,
  SUPPLIER_PROFILE_URL,
  SUPPLIER_RELATION_URL,
  createInvoiceRelationFixtures,
} from "./relation-test-fixtures";
import { useEntityItemToOneRelation } from "./use-entity-item-to-one-relation";

// ---------------------------------------------------------------------------
// Fixture factories
//
// Root only exposes the invoice + supplier profiles (not lineItem) — the
// invoice profile still embeds both relations, but this suite only ever
// resolves the supplier target profile, matching the original fixture.
// ---------------------------------------------------------------------------

const {
  profileRootBody,
  invoiceProfileBody,
  supplierProfileBody,
  makeEntityItemWithTemplates,
  setupProfileHandlers,
} = createInvoiceRelationFixtures({
  rootProfiles: ["supplier"],
});

/**
 * Build the supplier relation from the invoice item.
 * The profile relation is resolved from the invoice profile's blueprint:relation metadata.
 */
function makeSupplierRelation(etag: string | null = '"v1"'): EntityItemToOneRelation {
  const item: EntityItem = makeEntityItemWithTemplates(etag, {});
  const link = item.halItem.links.findLink(cgRels.relation, "supplier");
  if (!link) throw new Error("supplier cg:relation link not found");
  const profileRelation = item.profileEntity.getRelation("supplier");
  if (!profileRelation) throw new Error("supplier profile relation not found in invoice profile");
  return new EntityItemToOneRelation("supplier", link, profileRelation, item);
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
