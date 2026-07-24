/**
 * Tests for useClearRelation hook.
 *
 * useClearRelation (DELETE):
 * - clear success for to-one relation (DELETE 204 → isSuccess; data is void)
 * - clear success for to-many relation (DELETE 204 → isSuccess; data is void)
 * - 412 no retry
 * - 409 integrity/required-relation → isError
 * - Relation read key (toOneRelation.byUrl for to-one) is invalidated on settled
 * - Relation read key (toManyRelation.byUrl for to-many) is invalidated on settled
 * - Source item (entityItem.byUrl) is invalidated on settled (ETag may be bumped)
 * - Target byUrlForName key and entityItemCollection keys are NOT invalidated
 * - Caller onSettled runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { invoiceClearSupplierTemplate } from "../../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationUnlinkHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import type { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { queryKeys } from "../../query-keys";
import { makeQueryClient, makeWrapper } from "../test-utils";
import {
  LINE_ITEMS_RELATION_URL,
  SUPPLIER_RELATION_URL,
  createInvoiceRelationFixtures,
  getToManyRelationOrThrow,
  getToOneRelationOrThrow,
} from "./relation-test-fixtures";
import { useClearRelation } from "./use-clear-relation";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const { makeEntityItemWithTemplates, setupProfileHandlers } = createInvoiceRelationFixtures();

function makeEntityItemWithClearSupplierTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithTemplates(etag, {
    "clear-supplier": {
      ...invoiceClearSupplierTemplate,
      target: SUPPLIER_RELATION_URL,
    },
  });
}

function makeEntityItemWithClearLineItemsTemplate(etag: string | null = '"v1"'): EntityItem {
  // clear-lineItems template — DELETE on the to-many relation
  return makeEntityItemWithTemplates(etag, {
    "clear-lineItems": {
      method: "DELETE",
      target: LINE_ITEMS_RELATION_URL,
      properties: [],
    },
  });
}

/** Get the to-one supplier relation (needs a clear template) */
function getSupplierToOneRelation(entityItem: EntityItem): EntityItemToOneRelation {
  return getToOneRelationOrThrow(entityItem, "supplier");
}

/** Get the to-many lineItems relation (needs a clear template) */
function getLineItemsToManyRelation(entityItem: EntityItem): EntityItemToManyRelation {
  return getToManyRelationOrThrow(entityItem, "lineItems");
}

// ===========================================================================
// useClearRelation — clear success (to-one)
// ===========================================================================

describe("useClearRelation — clear success (to-one)", () => {
  it("returns isSuccess and data is void on clear of a to-one relation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ===========================================================================
// useClearRelation — clear success (to-many)
// ===========================================================================

describe("useClearRelation — clear success (to-many)", () => {
  it("returns isSuccess and data is void on clear of a to-many relation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ===========================================================================
// useClearRelation — 412 no retry
// ===========================================================================

describe("useClearRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    setupProfileHandlers();
    let deleteCallCount = 0;

    server.use(
      http.delete(SUPPLIER_RELATION_URL, () => {
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

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
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
// useClearRelation — 409 integrity/required-relation
// ===========================================================================

describe("useClearRelation — 409 integrity/required-relation", () => {
  it("surfaces 409 required-relation as ProblemDetailError with status 409", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: SUPPLIER_RELATION_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/required-relation",
        title: "Cannot clear required relation",
      }),
    );

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(409);
    expect(err.problemDetail.type).toContain("required-relation");
  });
});

// ===========================================================================
// useClearRelation — relation read key invalidation
// ===========================================================================

describe("useClearRelation — relation read key invalidation", () => {
  it("invalidates the toOneRelation read key on settled (to-one clear)", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The key uses the relation name ("supplier") + relation.link.href
    const readKey = queryKeys.toOneRelation.byUrl("supplier", SUPPLIER_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the toManyRelation read key on settled (to-many clear)", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The key uses the relation name ("lineItems") + relation.link.href
    const readKey = queryKeys.toManyRelation.byUrl("lineItems", LINE_ITEMS_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });
});

// ===========================================================================
// useClearRelation — source item invalidation and no over-invalidation
// ===========================================================================

describe("useClearRelation — source item invalidation and no over-invalidation", () => {
  it("invalidates the source item (entityItem.byUrl) on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Source item invalidated — relation op is gated on the source ETag and may bump it
    const sourceItemKey = queryKeys.entityItem.byUrl(
      relation.source.profileEntity,
      relation.source.selfLink.href,
    );
    const calledWithSourceKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: sourceItemKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithSourceKey).toBe(true);

    // Target byUrlForName key is NOT invalidated (previously-linked hrefs unknown + over-invalidation we avoid)
    const targetEntityItemInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "EntityItem" && queryKey[1] === "supplier";
    });
    expect(targetEntityItemInvalidations).toHaveLength(0);

    // entityItemCollection keys are NOT invalidated
    const collectionInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "EntitySearch";
    });
    expect(collectionInvalidations).toHaveLength(0);
  });

  it("caller onSettled runs after mutation settles", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(
      () =>
        useClearRelation(relation, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
