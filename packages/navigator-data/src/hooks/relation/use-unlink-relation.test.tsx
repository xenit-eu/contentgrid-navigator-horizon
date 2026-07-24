/**
 * Tests for useUnlinkRelation hook.
 *
 * useUnlinkRelation (DELETE single item from to-many):
 * - unlink success → isSuccess, data is void
 * - sends DELETE to relation.link.href/item.id (workaround URL construction)
 * - attaches If-Match from relation.source.etag
 * - 412 no retry
 * - Cache: invalidates toManyRelation.forRelationName on settled (all pages, item may shift)
 * - Cache: invalidates entityItem.byUrl for source item on settled (ETag may be bumped)
 * - Caller onSettled runs
 * - Caller onSuccess runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  createProblemHandler,
  createRelationUnlinkHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import { makeQueryClient, makeWrapper } from "../test-utils";
import {
  LINE_ITEMS_RELATION_URL,
  LINE_ITEM_ITEM_URL,
  createInvoiceRelationFixtures,
  getToManyRelationOrThrow,
} from "./relation-test-fixtures";
import { useUnlinkRelation } from "./use-unlink-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

// URL the hook actually sends DELETE to: relation.link.href + "/" + item.id
const UNLINK_URL = `${LINE_ITEMS_RELATION_URL}/li-001`;

// ---------------------------------------------------------------------------
// Fixture factories
//
// Only the lineItems relation is modeled — this suite has no supplier
// relation at all, matching the original (smaller) fixture.
// ---------------------------------------------------------------------------

const {
  makeLineItemProfile,
  makeEntityItemWithTemplates: makeInvoiceItem,
  setupProfileHandlers,
} = createInvoiceRelationFixtures({ relations: ["lineItems"] });

/** Line item to unlink — only needs an id; no delete template required for unlink. */
function makeLineItem(): EntityItem {
  const profile = makeLineItemProfile();
  const body = {
    id: "li-001",
    _links: { self: { href: LINE_ITEM_ITEM_URL } },
    _templates: {},
  };
  const hal = new HalObject(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, null);
}

function getLineItemsRelation(invoiceItem: EntityItem): EntityItemToManyRelation {
  return getToManyRelationOrThrow(invoiceItem, "lineItems");
}

// ===========================================================================
// useUnlinkRelation — unlink success
// ===========================================================================

describe("useUnlinkRelation — unlink success", () => {
  it("returns isSuccess and data is void", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("sends DELETE to relation.link.href/item.id", async () => {
    setupProfileHandlers();
    let capturedUrl: string | null = null;

    server.use(
      http.delete(UNLINK_URL, ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toBe(UNLINK_URL);
  });

  it("attaches If-Match from relation.source.etag", async () => {
    setupProfileHandlers();
    let capturedIfMatch: string | null = null;

    server.use(
      http.delete(UNLINK_URL, ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBe('"v1"');
  });
});

// ===========================================================================
// useUnlinkRelation — 412 no retry
// ===========================================================================

describe("useUnlinkRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    setupProfileHandlers();
    let deleteCallCount = 0;

    server.use(
      http.delete(UNLINK_URL, () => {
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
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
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
// useUnlinkRelation — 403 ABAC denial
// ===========================================================================

describe("useUnlinkRelation — 403 ABAC denial", () => {
  it("surfaces 403 as ProblemDetailError", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: UNLINK_URL,
        status: 403,
        title: "Forbidden",
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(403);
  });
});

// ===========================================================================
// useUnlinkRelation — cache invalidation on settled
// ===========================================================================

describe("useUnlinkRelation — cache invalidation on settled", () => {
  it("invalidates toManyRelation.forRelationName on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // All pages for this relation are busted — items can shift across pages after removal
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const invalidatedToMany = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toManyKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToMany).toBe(true);
  });

  it("invalidates source item (entityItem.byUrl) on settled so ETag stays fresh", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Source item invalidated — ETag may change after an unlink, must stay fresh for next mutation
    const sourceItemKey = queryKeys.entityItem.byUrl(
      relation.source.profileEntity,
      relation.source.selfLink.href,
    );
    const invalidatedSource = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: sourceItemKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedSource).toBe(true);
  });

  it("caller onSettled runs after cache invalidation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const callerOnSettled = vi.fn();

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(
      () => useUnlinkRelation(relation, { mutationOptions: { onSettled: callerOnSettled } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });

  it("caller onSuccess runs on successful unlink", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const callerOnSuccess = vi.fn();

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(
      () => useUnlinkRelation(relation, { mutationOptions: { onSuccess: callerOnSuccess } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSuccess).toHaveBeenCalledOnce();
  });

  it("still invalidates cache on settled even when unlink fails", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: UNLINK_URL,
        status: 403,
        title: "Forbidden",
      }),
    );

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // onSettled runs on both success and error — cache must still be busted
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const invalidatedToMany = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toManyKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToMany).toBe(true);
  });
});
