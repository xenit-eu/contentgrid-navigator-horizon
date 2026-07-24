/**
 * Tests for useDeleteRelationItem hook.
 *
 * useDeleteRelationItem (DELETE entity item via relation context):
 * - delete success (to-one context) → isSuccess, data is the deleted EntityItem
 * - delete success (to-many context) → isSuccess, data is the deleted EntityItem
 * - 412 no retry
 * - Cache: removeQueries on entityItem.byUrl for the deleted item
 * - Cache: invalidateQueries on entityItemCollection.forEntity (global list)
 * - Cache invalidation (to-one context): invalidates toOneRelation.byUrl
 * - Cache invalidation (to-many context): invalidates toManyRelation.forRelationName
 * - Caller onSuccess runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { createDeleteHandler, createProblemHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import {
  SUPPLIER_RELATION_URL,
  createInvoiceRelationFixtures,
  getToManyRelationOrThrow,
  getToOneRelationOrThrow,
} from "./relation-test-fixtures";
import { useDeleteRelationItem } from "./use-delete-relation-item";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const SUPPLIER_ITEM_URL = `${BASE}/suppliers/sup-001`;
const LINE_ITEM_ITEM_URL = `${BASE}/line-items/li-001`;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const {
  makeEntityItemWithTemplates,
  makeSupplierProfile,
  makeLineItemProfile,
  setupProfileHandlers,
} = createInvoiceRelationFixtures();

/** Source invoice item — holds the relation links. */
function makeInvoiceItem(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithTemplates(etag, {});
}

/** Supplier item (to-one target) with a delete template so deleteEntityItemRequest() works. */
function makeSupplierItemWithDeleteTemplate(etag: string | null = '"v2"'): EntityItem {
  const profile = makeSupplierProfile();
  const body = {
    id: "sup-001",
    _links: { self: { href: SUPPLIER_ITEM_URL } },
    _templates: {
      delete: { method: "DELETE", target: SUPPLIER_ITEM_URL, properties: [] },
    },
  };
  const hal = new HalObject(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

/** Line item (to-many target) with a delete template so deleteEntityItemRequest() works. */
function makeLineItemWithDeleteTemplate(etag: string | null = '"v3"'): EntityItem {
  const profile = makeLineItemProfile();
  const body = {
    id: "li-001",
    _links: { self: { href: LINE_ITEM_ITEM_URL } },
    _templates: {
      delete: { method: "DELETE", target: LINE_ITEM_ITEM_URL, properties: [] },
    },
  };
  const hal = new HalObject(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

function getSupplierToOneRelation(invoiceItem: EntityItem): EntityItemToOneRelation {
  return getToOneRelationOrThrow(invoiceItem, "supplier");
}

function getLineItemsToManyRelation(invoiceItem: EntityItem): EntityItemToManyRelation {
  return getToManyRelationOrThrow(invoiceItem, "lineItems");
}

// ===========================================================================
// useDeleteRelationItem — delete success (to-one context)
// ===========================================================================

describe("useDeleteRelationItem — delete success (to-one context)", () => {
  it("returns isSuccess and data is the deleted EntityItem", async () => {
    setupProfileHandlers();
    server.use(createDeleteHandler({ url: SUPPLIER_ITEM_URL }));

    const invoiceItem = makeInvoiceItem('"v1"');
    const supplierItem = makeSupplierItemWithDeleteTemplate('"v2"');
    const relation = getSupplierToOneRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(supplierItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(supplierItem);
  });
});

// ===========================================================================
// useDeleteRelationItem — delete success (to-many context)
// ===========================================================================

describe("useDeleteRelationItem — delete success (to-many context)", () => {
  it("returns isSuccess and data is the deleted EntityItem", async () => {
    setupProfileHandlers();
    server.use(createDeleteHandler({ url: LINE_ITEM_ITEM_URL }));

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItemWithDeleteTemplate('"v3"');
    const relation = getLineItemsToManyRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(lineItem);
  });
});

// ===========================================================================
// useDeleteRelationItem — 412 no retry
// ===========================================================================

describe("useDeleteRelationItem — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    setupProfileHandlers();
    let deleteCallCount = 0;

    server.use(
      http.delete(LINE_ITEM_ITEM_URL, () => {
        deleteCallCount++;
        return HttpResponse.json(
          {
            status: 412,
            title: "Precondition Failed",
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
          },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItemWithDeleteTemplate('"v3"');
    const relation = getLineItemsToManyRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(deleteCallCount).toBe(1);
  });
});

// ===========================================================================
// useDeleteRelationItem — 409 integrity/required-relation
// ===========================================================================

describe("useDeleteRelationItem — 409 integrity/required-relation", () => {
  it("surfaces 409 required-relation as ProblemDetailError", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: SUPPLIER_ITEM_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/required-relation",
        title: "Cannot delete entity with required relation",
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const supplierItem = makeSupplierItemWithDeleteTemplate('"v2"');
    const relation = getSupplierToOneRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(supplierItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(409);
    expect(err.problemDetail.type).toContain("required-relation");
  });
});

// ===========================================================================
// useDeleteRelationItem — cache invalidation (to-one context)
// ===========================================================================

describe("useDeleteRelationItem — cache invalidation (to-one context)", () => {
  it("removes the deleted item from cache and invalidates the to-one relation read key on success", async () => {
    setupProfileHandlers();
    server.use(createDeleteHandler({ url: SUPPLIER_ITEM_URL }));

    const queryClient = makeQueryClient();
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const supplierItem = makeSupplierItemWithDeleteTemplate('"v2"');
    const relation = getSupplierToOneRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(supplierItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Item removed from cache
    const itemKey = queryKeys.entityItem.byUrl(supplierItem.profileEntity, SUPPLIER_ITEM_URL);
    const removedItemKey = removeSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: itemKey }).asymmetricMatch(call[0]),
    );
    expect(removedItemKey).toBe(true);

    // Global collection invalidated
    const collectionKey = queryKeys.entityItemCollection.forEntity(supplierItem.profileEntity);
    const invalidatedCollection = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: collectionKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedCollection).toBe(true);

    // to-one relation read key invalidated
    const toOneKey = queryKeys.toOneRelation.byUrl("supplier", SUPPLIER_RELATION_URL);
    const invalidatedToOne = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toOneKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToOne).toBe(true);

    // toManyRelation key is NOT invalidated
    const toManyInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "ToManyRelation";
    });
    expect(toManyInvalidations).toHaveLength(0);
  });
});

// ===========================================================================
// useDeleteRelationItem — cache invalidation (to-many context)
// ===========================================================================

describe("useDeleteRelationItem — cache invalidation (to-many context)", () => {
  it("removes the deleted item from cache and invalidates toManyRelation.forRelationName on success", async () => {
    setupProfileHandlers();
    server.use(createDeleteHandler({ url: LINE_ITEM_ITEM_URL }));

    const queryClient = makeQueryClient();
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItemWithDeleteTemplate('"v3"');
    const relation = getLineItemsToManyRelation(invoiceItem);

    const { result } = renderHook(() => useDeleteRelationItem(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Item removed from cache
    const itemKey = queryKeys.entityItem.byUrl(lineItem.profileEntity, LINE_ITEM_ITEM_URL);
    const removedItemKey = removeSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: itemKey }).asymmetricMatch(call[0]),
    );
    expect(removedItemKey).toBe(true);

    // Global collection invalidated
    const collectionKey = queryKeys.entityItemCollection.forEntity(lineItem.profileEntity);
    const invalidatedCollection = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: collectionKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedCollection).toBe(true);

    // toManyRelation.forRelationName invalidated (all pages, since item may shift pages)
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const invalidatedToMany = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toManyKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToMany).toBe(true);

    // toOneRelation key is NOT invalidated
    const toOneInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "ToOneRelation";
    });
    expect(toOneInvalidations).toHaveLength(0);
  });

  it("caller onSuccess runs after cache cleanup", async () => {
    setupProfileHandlers();
    server.use(createDeleteHandler({ url: LINE_ITEM_ITEM_URL }));

    const callerOnSuccess = vi.fn();

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItemWithDeleteTemplate('"v3"');
    const relation = getLineItemsToManyRelation(invoiceItem);

    const { result } = renderHook(
      () => useDeleteRelationItem(relation, { mutationOptions: { onSuccess: callerOnSuccess } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSuccess).toHaveBeenCalledOnce();
  });
});
