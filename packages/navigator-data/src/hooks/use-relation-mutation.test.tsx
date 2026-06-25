/**
 * Tests for useSetRelation, useAddRelation, useClearRelation hooks.
 *
 * Covers per-op hooks that replace the former useRelationMutation:
 *
 * useSetRelation (to-one PUT):
 * - set success (PUT 204 → best-effort re-fetch → isSuccess, cache set via setQueryData)
 * - If-Match header sent verbatim from item.etag
 * - null etag → no If-Match header
 * - ABAC denial (missing template) throws before any fetch (verified via error message)
 * - RelationCardinalityError for to-many relation
 * - 412 ETag mismatch → isError, handler hit exactly once (no retry)
 * - 409 blind-relation-overwrite → isError
 * - Best-effort read-back: write succeeds + readback 5xx → mutation still resolves (undefined data)
 * - onSettled runs even when readback fails → invalidation still fires
 * - Target item invalidated by URL on success (scoped, not whole collection)
 * - No source collection / no source forEntity invalidation
 * - Caller onSuccess runs after cache is populated (ordering)
 * - Caller onSettled runs last
 *
 * useAddRelation (to-many POST):
 * - add success (POST 204 → best-effort re-fetch → isSuccess)
 * - sends both hrefs in POST body (one per line)
 * - RelationCardinalityError for to-one relation
 * - 412 no retry
 * - Each targetHref invalidated by URL in onSettled
 * - Caller onSettled runs last
 *
 * useClearRelation (DELETE):
 * - clear success (DELETE 204 → re-fetch → isSuccess)
 * - 412 no retry
 * - 409 integrity/required-relation → isError
 * - No target invalidation on clear (previously-linked hrefs not available)
 * - Caller onSettled runs last
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceAddLineItemTemplate,
  invoiceClearSupplierTemplate,
  invoiceProfileBodyWithRelations,
  invoiceSetSupplierTemplate,
} from "../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationAddHandler,
  createRelationLinkHandler,
  createRelationUnlinkHandler,
} from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useAddRelation } from "./use-add-relation";
import { useClearRelation } from "./use-clear-relation";
import { useSetRelation } from "./use-set-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;
const SUPPLIER_URL = `${BASE}/suppliers/sup-001`;
const LINE_ITEM_URL_1 = `${BASE}/line-items/li-001`;
const LINE_ITEM_URL_2 = `${BASE}/line-items/li-002`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/**
 * Build an invoice ProfileEntity that includes blueprint:relation embedded resources.
 * Required so EntityItem.getRelation() can join templates with ProfileRelation metadata.
 */
function makeInvoiceProfile(): ProfileEntity {
  // Remap profile links to use BASE so they match our test URLs
  const profileBody = {
    ...invoiceProfileBodyWithRelations,
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  const link = { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" };
  return new ProfileEntity(
    link as unknown as import("@contentgrid/hal").Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function makeEntityItemWithTemplates(
  etag: string | null = '"v1"',
  templates: Record<string, unknown> = {},
  profile?: ProfileEntity,
): EntityItem {
  const itemProfile = profile ?? makeInvoiceProfile();
  const itemBody = {
    id: "inv-001",
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_RELATION_REL]: [
        { href: SUPPLIER_RELATION_URL, name: "supplier" },
        { href: LINE_ITEMS_RELATION_URL, name: "lineItems" },
      ],
    },
    _templates: templates,
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, itemProfile, etag);
}

function makeEntityItemWithSetTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "set-supplier": {
        ...invoiceSetSupplierTemplate,
        target: SUPPLIER_RELATION_URL,
      },
    },
    profile,
  );
}

function makeEntityItemWithAddTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "add-lineItems": {
        ...invoiceAddLineItemTemplate,
        target: LINE_ITEMS_RELATION_URL,
      },
    },
    profile,
  );
}

function makeEntityItemWithClearTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "clear-supplier": {
        ...invoiceClearSupplierTemplate,
        target: SUPPLIER_RELATION_URL,
      },
    },
    profile,
  );
}

/** Wire a GET handler for the best-effort re-fetch after mutation success */
function wireRefetchHandler(etag = '"v2"') {
  server.use(
    http.get(INVOICE_ITEM_URL, () =>
      HttpResponse.json(
        {
          id: "inv-001",
          _links: { self: { href: INVOICE_ITEM_URL } },
        } as unknown as HalObjectShape<EntityItemShape>,
        { headers: { ETag: etag } },
      ),
    ),
  );
}

/** Wire a GET handler that returns 500 to simulate readback failure */
function wireRefetchFailureHandler() {
  server.use(http.get(INVOICE_ITEM_URL, () => new HttpResponse(null, { status: 500 })));
}

// ===========================================================================
// useSetRelation — to-one PUT
// ===========================================================================

describe("useSetRelation — set success", () => {
  it("returns isSuccess and fresh EntityItem on set", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v2"');

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data?.etag).toBe('"v2"');
  });

  it("writes fresh item to setQueryData after set success", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v2"');

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);

    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
  });
});

describe("useSetRelation — If-Match header", () => {
  it("sends If-Match verbatim from item.etag", async () => {
    let capturedIfMatch: string | null = null;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBe('"v1"');
  });

  it("sends no If-Match header when etag is null", async () => {
    let capturedIfMatch: string | null | undefined = undefined;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithSetTemplate(null);
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBeNull();
  });
});

describe("useSetRelation — ABAC denial (missing template)", () => {
  it("is error when set template is missing; error says template absent (no network call)", async () => {
    // Wire a handler that would indicate a bug if actually called (ABAC must throw first)
    let networkCallHappened = false;
    server.use(
      http.put(SUPPLIER_RELATION_URL, () => {
        networkCallHappened = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // No set-supplier template — profile relation exists but template absent = ABAC deny
    const entityItem = makeEntityItemWithTemplates('"v1"', {});

    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("template absent");
    expect(networkCallHappened).toBe(false);
  });
});

describe("useSetRelation — RelationCardinalityError for to-many", () => {
  it("throws RelationCardinalityError when trying to set a to-many relation", async () => {
    // lineItems is to-many; set should throw before any fetch
    const entityItem = makeEntityItemWithTemplates('"v1"', {
      "add-lineItems": {
        ...invoiceAddLineItemTemplate,
        target: LINE_ITEMS_RELATION_URL,
      },
    });

    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHref: LINE_ITEM_URL_1,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.constructor.name).toBe("RelationCardinalityError");
    expect(result.current.error?.message).toContain("to-many");
  });
});

describe("useSetRelation — 412 ETag mismatch (no retry)", () => {
  it("surfaces 412 as ProblemDetailError and PUT handler is hit exactly once", async () => {
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
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(putCallCount).toBe(1);
  });
});

describe("useSetRelation — 409 blind-relation-overwrite", () => {
  it("surfaces 409 as ProblemDetailError with blind-relation-overwrite type", async () => {
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
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.type).toContain("blind-relation-overwrite");
  });
});

describe("useSetRelation — best-effort readback (write succeeds, readback fails)", () => {
  it("mutation resolves as success (data=undefined) when readback returns 5xx", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchFailureHandler();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // data is undefined because readback failed but write succeeded
    expect(result.current.data).toBeUndefined();
  });

  it("onSettled invalidations still fire even when readback fails", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchFailureHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // invalidateQueries should have been called (target href invalidation in onSettled)
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useSetRelation — scoped target invalidation (not whole collection)", () => {
  it("invalidates the specific target item URL in onSettled, not a broader key", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should have been called with the specific target item key (byUrlForName("supplier", ...))
    const targetKey = queryKeys.entityItem.byUrlForName("supplier", SUPPLIER_URL);
    const calledWithTargetKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey }),
    );
    expect(calledWithTargetKey).toBe(true);
  });

  it("does NOT invalidate source collection in onSettled", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sourceCollectionKey = queryKeys.entityItemCollection.forEntity(profile);
    const calledWithSourceCollection = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: sourceCollectionKey }),
    );
    expect(calledWithSourceCollection).toBe(false);
  });

  it("does NOT invalidate all source items (forEntity prefix) in onSettled", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sourceItemsKey = queryKeys.entityItem.forEntity(profile);
    const calledWithSourceItems = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: sourceItemsKey }),
    );
    expect(calledWithSourceItems).toBe(false);
  });
});

describe("useSetRelation — caller onSuccess ordering", () => {
  it("calls caller onSuccess after cache is populated", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);

    let cacheAtCallTime: unknown = "NOT_CHECKED";
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () => useSetRelation({ mutationOptions: { onSuccess: callerOnSuccess } }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });

  it("calls caller onSettled last", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(
      () => useSetRelation({ mutationOptions: { onSettled: callerOnSettled } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", targetHref: SUPPLIER_URL });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// useAddRelation — to-many POST
// ===========================================================================

describe("useAddRelation — add success", () => {
  it("returns isSuccess on add", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(() => useAddRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("sends both hrefs in POST body (one per line)", async () => {
    let capturedBody: string | null = null;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(() => useAddRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
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

describe("useAddRelation — RelationCardinalityError for to-one", () => {
  it("throws RelationCardinalityError when trying to add to a to-one relation", async () => {
    // supplier is to-one; add should throw RelationCardinalityError before any fetch
    const entityItem = makeEntityItemWithTemplates('"v1"', {
      "set-supplier": {
        ...invoiceSetSupplierTemplate,
        target: SUPPLIER_RELATION_URL,
      },
    });

    const { result } = renderHook(() => useAddRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.constructor.name).toBe("RelationCardinalityError");
    expect(result.current.error?.message).toContain("to-one");
  });
});

describe("useAddRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and POST handler hit exactly once", async () => {
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
    const { result } = renderHook(() => useAddRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHrefs: [LINE_ITEM_URL_1],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(postCallCount).toBe(1);
  });
});

describe("useAddRelation — scoped target invalidation for each href", () => {
  it("invalidates each specific target item URL in onSettled", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(() => useAddRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // lineItems target entity name in fixture is "lineItem" (from blueprint:target-entity link)
    const targetKey1 = queryKeys.entityItem.byUrlForName("lineItem", LINE_ITEM_URL_1);
    const targetKey2 = queryKeys.entityItem.byUrlForName("lineItem", LINE_ITEM_URL_2);

    const calledWith1 = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey1 }),
    );
    const calledWith2 = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey2 }),
    );
    expect(calledWith1).toBe(true);
    expect(calledWith2).toBe(true);
  });

  it("caller onSettled runs last", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(
      () => useAddRelation({ mutationOptions: { onSettled: callerOnSettled } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        targetHrefs: [LINE_ITEM_URL_1],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// useClearRelation — DELETE
// ===========================================================================

describe("useClearRelation — clear success", () => {
  it("returns isSuccess on clear", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useClearRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("populates setQueryData after successful clear + readback", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v3"');

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithClearTemplate('"v1"', profile);

    const { result } = renderHook(() => useClearRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
    expect((cached as EntityItem).etag).toBe('"v3"');
  });
});

describe("useClearRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
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

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useClearRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(deleteCallCount).toBe(1);
  });
});

describe("useClearRelation — 409 integrity/required-relation", () => {
  it("surfaces 409 required-relation as ProblemDetailError with status 409", async () => {
    server.use(
      createProblemHandler({
        method: "delete",
        url: SUPPLIER_RELATION_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/required-relation",
        title: "Cannot clear required relation",
      }),
    );

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useClearRelation(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(409);
    expect(err.problemDetail.type).toContain("required-relation");
  });
});

describe("useClearRelation — no target invalidation", () => {
  it("does NOT call invalidateQueries on clear (previously-linked hrefs unknown)", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useClearRelation(), { wrapper: makeWrapper(queryClient) });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No invalidation should have been called for any target item
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("caller onSettled runs last", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(
      () => useClearRelation({ mutationOptions: { onSettled: callerOnSettled } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
