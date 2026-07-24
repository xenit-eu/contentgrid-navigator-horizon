/**
 * Tests for useSetToOneRelation hook.
 *
 * useSetToOneRelation (to-one PUT):
 * - set success (PUT 204 → isSuccess; data is void)
 * - If-Match header sent verbatim from source.etag
 * - null etag → no If-Match header
 * - ABAC denial (missing template) throws before any fetch (verified via error message)
 * - 412 ETag mismatch → isError, handler hit exactly once (no retry)
 * - 409 blind-relation-overwrite → isError
 * - Relation read key (toOneRelation.byUrl) is invalidated on settled
 * - Source item (entityItem.byUrl) is invalidated on settled (ETag may be bumped)
 * - Target byUrlForName key and entityItemCollection keys are NOT invalidated
 * - Caller onSettled runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { invoiceSetSupplierTemplate } from "../../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationLinkHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import type { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import { queryKeys } from "../../query-keys";
import { makeQueryClient, makeWrapper } from "../test-utils";
import {
  SUPPLIER_ITEM_URL,
  SUPPLIER_RELATION_URL,
  createInvoiceRelationFixtures,
  getToOneRelationOrThrow,
} from "./relation-test-fixtures";
import { useSetToOneRelation } from "./use-set-to-one-relation";

// ---------------------------------------------------------------------------
// Fixture factories
//
// Root only exposes the invoice + supplier profiles (not lineItem) — the
// invoice profile still embeds both relations, but this suite only ever
// resolves the supplier target profile, matching the original fixture.
// ---------------------------------------------------------------------------

const { makeEntityItemWithTemplates, setupProfileHandlers } = createInvoiceRelationFixtures({
  rootProfiles: ["supplier"],
});

function makeEntityItemWithSetTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithTemplates(etag, {
    "set-supplier": {
      ...invoiceSetSupplierTemplate,
      target: SUPPLIER_RELATION_URL,
    },
  });
}

/** Get the to-one supplier relation from an entity item */
function getSupplierRelation(entityItem: EntityItem): EntityItemToOneRelation {
  return getToOneRelationOrThrow(entityItem, "supplier");
}

// ===========================================================================
// useSetToOneRelation — set success
// ===========================================================================

describe("useSetToOneRelation — set success", () => {
  it("returns isSuccess and data is void on set", async () => {
    setupProfileHandlers();
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ===========================================================================
// useSetToOneRelation — If-Match header
// ===========================================================================

describe("useSetToOneRelation — If-Match header", () => {
  it("sends If-Match verbatim from source.etag", async () => {
    setupProfileHandlers();
    let capturedIfMatch: string | null = null;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBe('"v1"');
  });

  it("sends no If-Match header when etag is null", async () => {
    setupProfileHandlers();
    let capturedIfMatch: string | null | undefined = undefined;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const entityItem = makeEntityItemWithSetTemplate(null);
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBeNull();
  });
});

// ===========================================================================
// useSetToOneRelation — ABAC denial (missing template)
// ===========================================================================

describe("useSetToOneRelation — ABAC denial (missing template)", () => {
  it("is error when set template is missing; error says template absent (no network call)", async () => {
    setupProfileHandlers();
    let networkCallHappened = false;
    server.use(
      http.put(SUPPLIER_RELATION_URL, () => {
        networkCallHappened = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // No set-supplier template — template absent = ABAC deny
    const entityItem = makeEntityItemWithTemplates('"v1"', {});
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("template absent");
    expect(networkCallHappened).toBe(false);
  });
});

// ===========================================================================
// useSetToOneRelation — 412 ETag mismatch (no retry)
// ===========================================================================

describe("useSetToOneRelation — 412 ETag mismatch (no retry)", () => {
  it("surfaces 412 as ProblemDetailError and PUT handler is hit exactly once", async () => {
    setupProfileHandlers();
    let putCallCount = 0;

    server.use(
      http.put(SUPPLIER_RELATION_URL, () => {
        putCallCount++;
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

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(putCallCount).toBe(1);
  });
});

// ===========================================================================
// useSetToOneRelation — 409 blind-relation-overwrite
// ===========================================================================

describe("useSetToOneRelation — 409 blind-relation-overwrite", () => {
  it("surfaces 409 as ProblemDetailError with blind-relation-overwrite type", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "put",
        url: SUPPLIER_RELATION_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/blind-relation-overwrite",
        title: "Cannot overwrite existing relation without unlinking first",
      }),
    );

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.type).toContain("blind-relation-overwrite");
  });
});

// ===========================================================================
// useSetToOneRelation — cache invalidation behaviour
// ===========================================================================

describe("useSetToOneRelation — cache invalidation", () => {
  it("invalidates the toOneRelation read key on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The key uses the relation name ("supplier") + relation.link.href
    const readKey = queryKeys.toOneRelation.byUrl("supplier", SUPPLIER_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the source item (entityItem.byUrl) on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(() => useSetToOneRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
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

    // Target byUrlForName key is NOT invalidated (over-invalidation we deliberately avoid)
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
});

// ===========================================================================
// useSetToOneRelation — caller onSettled
// ===========================================================================

describe("useSetToOneRelation — caller onSettled", () => {
  it("calls caller onSettled after mutation settles", async () => {
    setupProfileHandlers();
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);

    const { result } = renderHook(
      () =>
        useSetToOneRelation(relation, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(SUPPLIER_ITEM_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
