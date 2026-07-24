/**
 * Tests for useAddToManyRelation hook.
 *
 * useAddToManyRelation (to-many POST):
 * - add success (POST 204 → isSuccess; data is void)
 * - sends both hrefs in POST body (one per line)
 * - ABAC denial (missing template) throws before any fetch
 * - 412 no retry
 * - Relation read key (toManyRelation.byUrl) is invalidated on settled
 * - Source item (entityItem.byUrl) is invalidated on settled (ETag may be bumped)
 * - Target byUrlForName key and entityItemCollection keys are NOT invalidated
 * - Caller onSettled runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { invoiceAddLineItemTemplate } from "../../../test-fixtures/hal/fixtures";
import { createRelationAddHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import type { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import { queryKeys } from "../../query-keys";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import {
  LINE_ITEMS_RELATION_URL,
  createInvoiceRelationFixtures,
  getToManyRelationOrThrow,
} from "./relation-test-fixtures";
import { useAddToManyRelation } from "./use-add-to-many-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const LINE_ITEM_URL_1 = `${BASE}/line-items/li-001`;
const LINE_ITEM_URL_2 = `${BASE}/line-items/li-002`;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const { makeEntityItemWithTemplates, setupProfileHandlers } = createInvoiceRelationFixtures();

function makeEntityItemWithAddTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithTemplates(etag, {
    "add-lineItems": {
      ...invoiceAddLineItemTemplate,
      target: LINE_ITEMS_RELATION_URL,
    },
  });
}

/** Get the to-many lineItems relation from an entity item */
function getLineItemsRelation(entityItem: EntityItem): EntityItemToManyRelation {
  return getToManyRelationOrThrow(entityItem, "lineItems");
}

// ===========================================================================
// useAddToManyRelation — add success
// ===========================================================================

describe("useAddToManyRelation — add success", () => {
  it("returns isSuccess and data is void on add", async () => {
    setupProfileHandlers();
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("sends both hrefs in POST body (one per line)", async () => {
    setupProfileHandlers();
    let capturedBody: string | null = null;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    const lines = capturedBody!
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toContain(LINE_ITEM_URL_1);
    expect(lines).toContain(LINE_ITEM_URL_2);
    expect(lines).toHaveLength(2);
  });
});

// ===========================================================================
// useAddToManyRelation — ABAC denial (missing template)
// ===========================================================================

describe("useAddToManyRelation — ABAC denial (missing template)", () => {
  it("is error when add template is missing; error says template absent (no network call)", async () => {
    setupProfileHandlers();
    let networkCallHappened = false;
    server.use(
      http.post(LINE_ITEMS_RELATION_URL, () => {
        networkCallHappened = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // No add-lineItems template — template absent = ABAC deny
    const entityItem = makeEntityItemWithTemplates('"v1"', {});
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("template absent");
    expect(networkCallHappened).toBe(false);
  });
});

// ===========================================================================
// useAddToManyRelation — 412 no retry
// ===========================================================================

describe("useAddToManyRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and POST handler hit exactly once", async () => {
    setupProfileHandlers();
    let postCallCount = 0;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, () => {
        postCallCount++;
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

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(postCallCount).toBe(1);
  });
});

// ===========================================================================
// useAddToManyRelation — cache invalidation
// ===========================================================================

describe("useAddToManyRelation — cache invalidation", () => {
  it("invalidates the toManyRelation read key on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The key uses the relation name ("lineItems") + relation.link.href
    const readKey = queryKeys.toManyRelation.byUrl("lineItems", LINE_ITEMS_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the source item (entityItem.byUrl) on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(() => useAddToManyRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
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
      return Array.isArray(queryKey) && queryKey[0] === "EntityItem" && queryKey[1] === "lineItem";
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
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);

    const { result } = renderHook(
      () =>
        useAddToManyRelation(relation, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
